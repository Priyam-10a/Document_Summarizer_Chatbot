# agent.py
# Agentic AI using LangChain 1.2.x + LangGraph + Llama 3

from langchain_ollama import ChatOllama
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent  # ✅ Keep here, NOT langchain.agents
from langgraph.checkpoint.memory import MemorySaver
from vector_store import search_similar_chunks, embed_and_store, clear_collection
import os

# ── Setup Llama 3 ─────────────────────────────────────────────
print("🔄 Loading Llama 3...")
llm = ChatOllama(model="llama3.1", temperature=0.3)  # llama3.1+ supports tools
print("✅ Llama 3 ready!")


# ── Define Tools using @tool decorator (new LangChain way) ────

@tool
def document_search(query: str) -> str:
    """Search the document for specific information or to answer
    questions about the document content."""
    results = search_similar_chunks(query, top_k=3)

    if not results:
        return "No relevant information found in the document."

    context = ""
    for r in results:
        context += f"[Chunk {r['rank']} | Score: {r['score']}]\n"
        context += f"{r['chunk']}\n\n"

    return context


@tool
def topic_summarizer(topic: str) -> str:
    """Get a summary of a specific topic from the document."""
    results = search_similar_chunks(topic, top_k=5)

    if not results:
        return "No relevant content found to summarize."

    context = "\n\n".join([r["chunk"] for r in results])

    prompt = f"""Based on the following document excerpts, provide a clear
and concise summary about: {topic}

Document excerpts:
{context}

Summary:"""

    return llm.invoke(prompt).content


@tool
def full_document_summary(input: str) -> str:
    """Generate a complete summary of the entire document."""
    results = search_similar_chunks(
        "main topics key points overview summary", top_k=8
    )

    if not results:
        return "No document loaded. Please upload a document first."

    context = "\n\n".join([r["chunk"] for r in results])

    prompt = f"""You are a document summarizer. Read the following document
excerpts and provide a comprehensive summary covering:
1. Main topic
2. Key points
3. Important details
4. Conclusion

Document excerpts:
{context}

Comprehensive Summary:"""

    return llm.invoke(prompt).content


# ── Create Agent ──────────────────────────────────────────────
tools   = [document_search, topic_summarizer, full_document_summary]
memory  = MemorySaver()


def create_agent():
    """Build and return the agent"""
    agent = create_react_agent(
        model=llm,
        tools=tools,
        checkpointer=memory
    )
    return agent


# ── Chat Function ─────────────────────────────────────────────
# Each conversation needs a thread_id for memory
config = {"configurable": {"thread_id": "chat-session-1"}}


def chat(agent, user_message):
    """Send a message to the agent and get a response"""
    print(f"\n{'='*50}")
    print(f"You: {user_message}")
    print(f"{'='*50}")

    result = agent.invoke(
        {"messages": [HumanMessage(content=user_message)]},
        config=config
    )

    # Get the last message (agent's final response)
    response = result["messages"][-1].content
    return response


# ── Quick Test ────────────────────────────────────────────────
if __name__ == "__main__":

    # Create test document if needed
    if not os.path.exists("test_document.txt"):
        print("📄 Creating test document...")
        dummy_content = """Artificial intelligence is transforming industries.
Machine learning allows computers to learn from data.
Deep learning uses neural networks to process complex patterns.
Natural language processing enables computers to understand human language.
RAG stands for Retrieval Augmented Generation.
It combines a retrieval system with a language model.
Vector databases store embeddings for fast similarity search.
ChromaDB is an open source vector database that runs locally.
LangChain is a framework for building AI applications.
Ollama lets you run large language models on your own hardware.
Document summarization extracts key information from long texts.
The agent can search documents and provide accurate answers.""" * 5

        with open("test_document.txt", "w") as f:
            f.write(dummy_content)

    # Load document into vector store
    print("\n📥 Loading test document into vector store...")
    clear_collection()
    embed_and_store("test_document.txt", chunk_size=60, overlap=10)

    # Create agent
    print("\n🤖 Creating agent...")
    agent = create_agent()

    # Test questions
    test_questions = [
        "What is RAG?",
        "Give me a full summary of the document",
        "What tools are mentioned for AI development?"
    ]

    for question in test_questions:
        response = chat(agent, question)
        print(f"\n🤖 Agent: {response}\n")
        print("-" * 50)