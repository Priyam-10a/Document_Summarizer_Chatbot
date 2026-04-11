# 🤖 Document Summarizer Chatbot (Agentic RAG System)

## 📌 Overview

This project implements an **AI-powered document summarization chatbot** using an **Agentic RAG (Retrieval-Augmented Generation) pipeline**.

Users can upload documents and interactively query them while receiving **accurate, context-aware summaries and answers** grounded in the document content.

The system runs **locally using Ollama**, making it **cost-efficient, private, and fully offline-capable**.

---

## 🧠 Key Features

- 📄 Upload and process documents (PDF / TXT)
- 🔍 Semantic search using vector embeddings
- 🤖 Context-aware Q&A over documents
- 🧾 Automatic summarization of long texts
- 🧠 Agentic workflow (multi-step reasoning + tool use)
- ⚡ Fast vector retrieval using ChromaDB
- 🔒 Fully local inference using Ollama (no API dependency)

---

## 🏗️ Architecture

User Query
↓
Embedding Model
↓
Vector Database (ChromaDB)
↓
Relevant Context Retrieval
↓
LLM via Ollama (Agentic Reasoning)
↓
Final Answer / Summary

---

## 🛠️ Tech Stack

- **Language:** Python
- **LLM Runtime:** Ollama
- **Vector DB:** ChromaDB
- **Frameworks/Libraries:** LangChain / LlamaIndex (if used)
- **Embeddings:** Sentence Transformers / Ollama embeddings
- **Frontend (optional):** Streamlit / CLI

---

## ▶️ Usage

### Run the chatbot:

```bash
python main.py
```

### Steps:

1. Upload a document
2. Ask questions
3. Get summaries / answers based on document context

---

## 📂 Project Structure

```
project-root/
│── data/              # Documents
│── embeddings/        # Vector store
│── src/
│   ├── ingestion.py
│   ├── retrieval.py
│   ├── agent.py
│   ├── summarizer.py
│── main.py
│── requirements.txt
│── README.md
```

---

## 🧪 Example Queries

- "Summarize this document in 5 points"
- "What are the key conclusions?"
- "Explain section 3 in simple terms"
- "Give a detailed summary of the methodology"

---

## 🚧 Future Improvements

- Add multi-document comparison
- Improve agent reasoning with tool chaining
- Add UI (Streamlit / Web app)
- Support more file formats (DOCX, HTML)
- Add memory for conversation context

---

## 🤝 Contributing

Contributions are welcome! Open an issue or submit a pull request.

---

## 📜 License

This project is licensed under the MIT License.
