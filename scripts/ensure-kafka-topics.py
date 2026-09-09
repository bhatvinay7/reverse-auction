#!/usr/bin/env python3
"""Create missing GitOps KafkaTopics after Kafka is Ready; require reconciliation."""
import json
from pathlib import Path
import subprocess
import sys

import yaml


def kubectl(*args, **kwargs):
    return subprocess.run(['kubectl', *args], check=True, text=True, **kwargs)


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'auction-k8s'
    documents = yaml.safe_load_all((root / 'infra/base/kafka/kafka-kraft.yaml').read_text())
    topics = [doc for doc in documents if doc and doc.get('kind') == 'KafkaTopic']
    if not topics:
        raise ValueError('No KafkaTopic definitions found')
    kubectl('wait', '-n', 'kafka', 'kafka/auction-kafka', '--for=condition=Ready', '--timeout=20m')
    for topic in topics:
        name = topic['metadata']['name']
        namespace = topic['metadata']['namespace']
        existing = kubectl('get', 'kafkatopic', name, '-n', namespace,
                           '--ignore-not-found', '-o', 'name', capture_output=True)
        if not existing.stdout.strip():
            # Apply is idempotent if Argo CD creates the resource concurrently.
            kubectl('apply', '-f', '-', input=json.dumps(topic))
        kubectl('wait', '-n', namespace, f'kafkatopic/{name}',
                '--for=condition=Ready', '--timeout=10m')
    print(f'All {len(topics)} Kafka topics are Ready.')


if __name__ == '__main__':
    main()
