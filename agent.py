# agent.py
# Agentic AI using Google Gemini + LangGraph ReAct

import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# ── LLM Setup ────────────────────────────────────────────────────────────────
print("🔄 Loading Gemini...")
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=GOOGLE_API_KEY,
    temperature=0.3,
)
print("✅ Gemini ready!")

memory = MemorySaver()


# ── Tool Factory ──────────────────────────────────────────────────────────────
# Tools are created per-conversation so they capture the conv_id in their closure.

def make_tools(conv_id: str):
    """Build LangChain tools scoped to a specific conversation."""
    from vector_store import search_similar_chunks

    @tool
    def document_search(query: str) -> str:
        """Search the uploaded document for specific information or to answer questions."""
        results = search_similar_chunks(conv_id, query, top_k=4)
        if not results:
            return "No relevant information found in the document."
        context = ""
        for r in results:
            context += f"[Chunk {r['rank']} | Score: {r['score']}]\n{r['chunk']}\n\n"
        return context

    @tool
    def topic_summarizer(topic: str) -> str:
        """Get a concise summary of a specific topic from the document."""
        results = search_similar_chunks(conv_id, topic, top_k=5)
        if not results:
            return "No relevant content found to summarize."
        context = "\n\n".join([r["chunk"] for r in results])
        prompt = (
            f"Based on the following document excerpts, provide a clear summary about: {topic}\n\n"
            f"Document excerpts:\n{context}\n\nSummary:"
        )
        return llm.invoke(prompt).content

    @tool
    def full_document_summary(input: str) -> str:  # noqa: A002
        """Generate a comprehensive summary of the entire uploaded document."""
        results = search_similar_chunks(
            conv_id, "main topics key points overview summary", top_k=8
        )
        if not results:
            return "No document loaded. Please upload a document first."
        context = "\n\n".join([r["chunk"] for r in results])
        prompt = (
            "You are a document summarizer. Read these excerpts and write a comprehensive summary covering:\n"
            "1. Main topic\n2. Key points\n3. Important details\n4. Conclusion\n\n"
            f"Document excerpts:\n{context}\n\nComprehensive Summary:"
        )
        return llm.invoke(prompt).content

    return [document_search, topic_summarizer, full_document_summary]


# ── Agent Factory ─────────────────────────────────────────────────────────────

def create_agent(conv_id: str):
    """Build a fresh ReAct agent scoped to a conversation."""
    tools = make_tools(conv_id)
    agent = create_react_agent(model=llm, tools=tools, checkpointer=memory)
    return agent


# ── Chat Helper ───────────────────────────────────────────────────────────────

def chat(agent, conv_id: str, user_message: str) -> str:
    """Invoke the agent and return its final text response."""
    config = {"configurable": {"thread_id": conv_id}}
    result = agent.invoke(
        {"messages": [HumanMessage(content=user_message)]},
        config=config,
    )
    return result["messages"][-1].content
