#!/bin/bash
set -euo pipefail

# This script generates a custom Certificate Authority (CA) and a Kafka Broker
# TLS certificate signed by that CA, formatted as Base64 for the .env.deployment file.
#
# The broker certificate includes the necessary Subject Alternative Names (SANs)
# required by the Strimzi Kafka operator and internal cluster DNS.

echo "Generating Kafka TLS Certificates..."

# Create a temporary directory for cert generation
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cd "$TMP_DIR"

# 1. Generate the Certificate Authority (CA)
echo "[1/4] Generating Certificate Authority (CA)..."
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.pem -subj "/O=Auction System/CN=Auction Kafka Internal CA"

# 2. Generate the Kafka Broker private key
echo "[2/4] Generating Kafka Broker Private Key..."
openssl genrsa -out broker.key 4096

# 3. Generate a Certificate Signing Request (CSR) with required SANs
echo "[3/4] Generating Certificate Signing Request (CSR)..."
cat > openssl.cnf <<EOF
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name
prompt = no

[req_distinguished_name]
O = Auction System
CN = auction-kafka-kafka-bootstrap.kafka.svc.cluster.local

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = auction-kafka-kafka-bootstrap.kafka.svc
DNS.2 = auction-kafka-kafka-bootstrap.kafka.svc.cluster.local
DNS.3 = auction-kafka-dual-role-0.auction-kafka-kafka-brokers.kafka.svc
DNS.4 = auction-kafka-dual-role-0.auction-kafka-kafka-brokers.kafka.svc.cluster.local
EOF

openssl req -new -key broker.key -out broker.csr -config openssl.cnf

# 4. Sign the broker CSR with the CA
echo "[4/4] Signing Broker Certificate with CA..."
openssl x509 -req -in broker.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -out broker.crt -days 3650 -sha256 -extfile openssl.cnf -extensions v3_req

# Output the results in base64 format (with no line wrapping)
echo ""
echo "================================================================"
echo "✅ Certificates successfully generated!"
echo "Copy the following lines into your .env.deployment file:"
echo "================================================================"
echo ""

# We use 'base64 -w 0' to ensure the output is on a single line
CA_B64=$(base64 -w 0 ca.pem)
CERT_B64=$(base64 -w 0 broker.crt)
KEY_B64=$(base64 -w 0 broker.key)

echo "KAFKA_SSL_CA_BASE64=$CA_B64"
echo "KAFKA_BROKER_CERT_BASE64=$CERT_B64"
echo "KAFKA_BROKER_KEY_BASE64=$KEY_B64"
echo ""
echo "================================================================"
