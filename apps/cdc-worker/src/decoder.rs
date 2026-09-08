use std::collections::HashMap;

pub enum WalEvent {
    Insert {
        table: String,
        fields: HashMap<String, Option<String>>,
    },
    Update {
        table: String,
        // Contains only the changed columns (unchanged cols are omitted)
        new_fields: HashMap<String, Option<String>>,
    },
    Delete {
        table: String,
        // With DEFAULT replica identity this is only the primary key column(s)
        key_fields: HashMap<String, Option<String>>,
    },
    Skip,
}

struct RelationInfo {
    name: String,
    columns: Vec<String>,
}

pub struct RelationRegistry {
    relations: HashMap<u32, RelationInfo>,
}

impl RelationRegistry {
    pub fn new() -> Self {
        Self {
            relations: HashMap::new(),
        }
    }

    /// Parse a raw pgoutput binary payload and return a typed WalEvent.
    /// Relation messages update the internal registry; all others are decoded
    /// against it. Returns Skip for unrecognised or non-row-change messages.
    pub fn process_message(&mut self, data: &[u8]) -> WalEvent {
        if data.is_empty() {
            return WalEvent::Skip;
        }

        let tag = data[0];
        let body = &data[1..];

        match tag {
            b'R' => {
                self.handle_relation(body);
                WalEvent::Skip
            }
            b'I' => self.handle_insert(body),
            b'U' => self.handle_update(body),
            b'D' => self.handle_delete(body),
            _ => WalEvent::Skip,
        }
    }

    // ── Relation ─────────────────────────────────────────────────────────────

    fn handle_relation(&mut self, body: &[u8]) {
        let mut p = Parser::new(body);

        let oid = match p.u32_be() {
            Some(v) => v,
            None => return,
        };
        let _namespace = p.cstr().unwrap_or_default();
        let name = p.cstr().unwrap_or_default();
        let _replica_identity = p.u8();
        let num_cols = match p.u16_be() {
            Some(v) => v as usize,
            None => return,
        };

        let mut columns = Vec::with_capacity(num_cols);
        for _ in 0..num_cols {
            let _flags = p.u8();
            let col_name = p.cstr().unwrap_or_default();
            let _type_oid = p.u32_be();
            let _type_mod = p.i32_be();
            columns.push(col_name);
        }

        self.relations.insert(oid, RelationInfo { name, columns });
    }

    // ── Insert ────────────────────────────────────────────────────────────────

    fn handle_insert(&self, body: &[u8]) -> WalEvent {
        let mut p = Parser::new(body);

        let oid = match p.u32_be() {
            Some(v) => v,
            None => return WalEvent::Skip,
        };
        let rel = match self.relations.get(&oid) {
            Some(r) => r,
            None => return WalEvent::Skip,
        };

        // 'N' marker (new tuple)
        if p.u8() != Some(b'N') {
            return WalEvent::Skip;
        }

        let fields = match parse_tuple(&mut p, &rel.columns) {
            Some(f) => f,
            None => return WalEvent::Skip,
        };

        eprintln!("[CDC] INSERT on table='{}'", rel.name);
        WalEvent::Insert {
            table: rel.name.clone(),
            fields,
        }
    }

    // ── Update ────────────────────────────────────────────────────────────────

    fn handle_update(&self, body: &[u8]) -> WalEvent {
        let mut p = Parser::new(body);

        let oid = match p.u32_be() {
            Some(v) => v,
            None => return WalEvent::Skip,
        };
        let rel = match self.relations.get(&oid) {
            Some(r) => r,
            None => return WalEvent::Skip,
        };

        let first = match p.u8() {
            Some(b) => b,
            None => return WalEvent::Skip,
        };

        let new_fields = match first {
            b'O' | b'K' => {
                // Old tuple precedes the new one; discard it then read 'N' + new
                let _old = parse_tuple(&mut p, &rel.columns);
                if p.u8() != Some(b'N') {
                    return WalEvent::Skip;
                }
                parse_tuple(&mut p, &rel.columns)
            }
            b'N' => parse_tuple(&mut p, &rel.columns),
            _ => return WalEvent::Skip,
        };

        match new_fields {
            Some(f) => WalEvent::Update {
                table: rel.name.clone(),
                new_fields: f,
            },
            None => WalEvent::Skip,
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    fn handle_delete(&self, body: &[u8]) -> WalEvent {
        let mut p = Parser::new(body);

        let oid = match p.u32_be() {
            Some(v) => v,
            None => return WalEvent::Skip,
        };
        let rel = match self.relations.get(&oid) {
            Some(r) => r,
            None => return WalEvent::Skip,
        };

        // 'O' (full old tuple) or 'K' (key-only) — both work the same way here
        let marker = p.u8();
        if !matches!(marker, Some(b'O') | Some(b'K')) {
            return WalEvent::Skip;
        }

        match parse_tuple(&mut p, &rel.columns) {
            Some(f) => WalEvent::Delete {
                table: rel.name.clone(),
                key_fields: f,
            },
            None => WalEvent::Skip,
        }
    }
}

// ── Tuple data parser ─────────────────────────────────────────────────────────

fn parse_tuple(p: &mut Parser<'_>, columns: &[String]) -> Option<HashMap<String, Option<String>>> {
    let num_cols = p.u16_be()? as usize;
    let mut fields = HashMap::with_capacity(num_cols);

    for i in 0..num_cols {
        let col_type = p.u8()?;
        let col_name = columns.get(i).map(|s| s.as_str()).unwrap_or("_unknown");

        match col_type {
            b'n' => {
                fields.insert(col_name.to_string(), None);
            }
            b'u' => {
                // Unchanged TOAST value — omit from the map so callers know it was not modified
            }
            b't' => {
                let len = p.u32_be()? as usize;
                let bytes = p.bytes(len)?;
                let value = String::from_utf8_lossy(bytes).into_owned();
                fields.insert(col_name.to_string(), Some(value));
            }
            _ => {}
        }
    }

    Some(fields)
}

// ── Minimal byte-slice parser ─────────────────────────────────────────────────

struct Parser<'a> {
    buf: &'a [u8],
}

impl<'a> Parser<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf }
    }

    fn u8(&mut self) -> Option<u8> {
        let b = *self.buf.first()?;
        self.buf = &self.buf[1..];
        Some(b)
    }

    fn u16_be(&mut self) -> Option<u16> {
        if self.buf.len() < 2 {
            return None;
        }
        let v = u16::from_be_bytes([self.buf[0], self.buf[1]]);
        self.buf = &self.buf[2..];
        Some(v)
    }

    fn u32_be(&mut self) -> Option<u32> {
        if self.buf.len() < 4 {
            return None;
        }
        let v = u32::from_be_bytes(self.buf[..4].try_into().unwrap());
        self.buf = &self.buf[4..];
        Some(v)
    }

    fn i32_be(&mut self) -> Option<i32> {
        if self.buf.len() < 4 {
            return None;
        }
        let v = i32::from_be_bytes(self.buf[..4].try_into().unwrap());
        self.buf = &self.buf[4..];
        Some(v)
    }

    fn cstr(&mut self) -> Option<String> {
        let pos = self.buf.iter().position(|&b| b == 0)?;
        let s = String::from_utf8_lossy(&self.buf[..pos]).into_owned();
        self.buf = &self.buf[pos + 1..];
        Some(s)
    }

    fn bytes(&mut self, n: usize) -> Option<&'a [u8]> {
        if self.buf.len() < n {
            return None;
        }
        let slice = &self.buf[..n];
        self.buf = &self.buf[n..];
        Some(slice)
    }
}
