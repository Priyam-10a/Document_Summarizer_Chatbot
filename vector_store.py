# vector_store.py
# Converts chunks into embeddings and stores them in ChromaDB

import os
import chromadb
from sentence_transformers import SentenceTransformer
from document_loader import load_and_chunk

# ── Setup ────────────────────────────────────────────────────
CHROMA_PATH = "./chroma_db"
EMBED_MODEL  = "all-MiniLM-L6-v2"

# Load the embedding model once (reused across functions)
print("🔄 Loading embedding model...")
embedder = SentenceTransformer(EMBED_MODEL)
print("✅ Embedding model ready!")


def get_chroma_client():
    """Get a persistent ChromaDB client"""
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    return client


def get_or_create_collection(client, collection_name="documents"):
    """Get existing collection or create a new one"""
    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}  # cosine similarity for text
    )
    return collection


def embed_and_store(file_path, collection_name="documents",
                    chunk_size=500, overlap=50):
    """
    Full pipeline:
    1. Load document
    2. Split into chunks
    3. Embed each chunk
    4. Store in ChromaDB
    """
    print(f"\n📥 Processing: {file_path}")

    # Step 1 & 2 — Load and chunk
    chunks = load_and_chunk(file_path, chunk_size, overlap)

    # Step 3 — Embed all chunks at once (faster than one by one)
    print("🔄 Generating embeddings...")
    embeddings = embedder.encode(chunks, show_progress_bar=True)
    print(f"✅ Generated {len(embeddings)} embeddings")

    # Step 4 — Store in ChromaDB
    print("💾 Storing in ChromaDB...")
    client     = get_chroma_client()
    collection = get_or_create_collection(client, collection_name)

    # Give each chunk a unique ID
    file_name = os.path.basename(file_path)
    ids = [f"{file_name}_chunk_{i}" for i in range(len(chunks))]

    # Store chunks + embeddings + metadata
    collection.add(
        ids        = ids,
        documents  = chunks,
        embeddings = embeddings.tolist(),
        metadatas  = [{"source": file_name, "chunk_index": i}
                      for i in range(len(chunks))]
    )

    print(f"✅ Stored {len(chunks)} chunks from '{file_name}' in ChromaDB!")
    return collection


def search_similar_chunks(query, collection_name="documents", top_k=3):
    """
    Search ChromaDB for the most relevant chunks
    given a user's query
    """
    # Embed the query using the same model
    query_embedding = embedder.encode([query]).tolist()

    client     = get_chroma_client()
    collection = get_or_create_collection(client, collection_name)

    # Find top_k most similar chunks
    results = collection.query(
        query_embeddings = query_embedding,
        n_results        = top_k,
        include          = ["documents", "distances", "metadatas"]
    )

    # Format results nicely
    chunks    = results["documents"][0]
    distances = results["distances"][0]
    metadatas = results["metadatas"][0]

    formatted = []
    for i, (chunk, dist, meta) in enumerate(
            zip(chunks, distances, metadatas)):
        formatted.append({
            "rank"     : i + 1,
            "chunk"    : chunk,
            "score"    : round(1 - dist, 3),  # convert distance to similarity
            "source"   : meta["source"],
            "chunk_idx": meta["chunk_index"]
        })

    return formatted


def clear_collection(collection_name="documents"):
    """Delete all stored chunks (fresh start)"""
    try:
        client = get_chroma_client()
        client.delete_collection(collection_name)
        print(f"🗑️  Cleared collection: {collection_name}")
    except Exception:
        print(f"ℹ️  No existing collection found — starting fresh!")


# ── Quick test ───────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("Testing Vector Store with dummy document...")
    print("=" * 50)

    # Create a dummy test file
    dummy_content = """Artificial intelligence is transforming industries worldwide.
Machine learning allows computers to learn from data without being explicitly programmed.
Deep learning uses multi-layered neural networks to process complex patterns.
Natural language processing enables computers to understand and generate human language.
RAG stands for Retrieval Augmented Generation.
It combines a retrieval system with a language model to generate accurate answers.
Vector databases store high-dimensional embeddings for fast similarity search.
ChromaDB is an open-source vector database that runs locally.
LangChain is a framework for building applications powered by language models.
Ollama allows you to run large language models locally on your own hardware.
Sentence transformers convert text into dense vector representations.
These vectors capture the semantic meaning of the text.""" * 5

    # Save dummy file
    with open("test_document.txt", "w") as f:
        f.write(dummy_content)
    print("📄 Created test_document.txt")

    # Clear any old data
    clear_collection()

    # Embed and store
    embed_and_store("test_document.txt", chunk_size=60, overlap=10)

    # Test search
    print("\n🔍 Testing search...")
    query   = "What is RAG and how does it work?"
    results = search_similar_chunks(query, top_k=3)

    print(f"\nQuery: '{query}'")
    print(f"Top {len(results)} results:\n")
    for r in results:
        print(f"Rank {r['rank']} | Score: {r['score']} | "
              f"Source: {r['source']}")
        print(f"  → {r['chunk'][:100]}...")
        print()

    print("🎉 Vector store is working!")