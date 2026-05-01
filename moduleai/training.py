# moduleai/training.py — Phase 1 stub
# Captures Q/A pairs for later fine-tune / RAG. DB layer in Phase 2.


class TrainingCollector:
    def collect(self, question: str, answer: str, tenant_id: str | None = None) -> None:
        print(f"TRAIN: [{tenant_id or '-'}] {question} → {answer}")
