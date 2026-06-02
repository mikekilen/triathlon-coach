import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import { TRIATHLON_COACH_SYSTEM_PROMPT } from "./coach-prompt.js";
import { tools, executeTool } from "./tools.js";

const client = new Anthropic();

const messages: Anthropic.MessageParam[] = [];

async function chat(userMessage: string): Promise<string> {
  messages.push({ role: "user", content: userMessage });

  // Agentic loop: keep going until Claude stops calling tools
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: TRIATHLON_COACH_SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      tools,
      messages,
    });

    // Collect text output from this turn
    const textParts: string[] = [];
    const toolUseBlocks: Anthropic.ContentBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // If no tool calls, we're done
    if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
      messages.push({ role: "assistant", content: response.content });
      return textParts.join("\n");
    }

    // Append assistant response (with tool_use blocks)
    messages.push({ role: "assistant", content: response.content });

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    // Send tool results back
    messages.push({ role: "user", content: toolResults });
  }
}

// ── Interactive CLI ─────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🏊 🚴 🏃 Triathlon Coach");
  console.log("Ask me anything about triathlon training, racing, or nutrition.");
  console.log('Type "quit" to exit.\n');

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === "quit") {
        console.log("Train smart. Race strong. See you out there!");
        rl.close();
        return;
      }

      try {
        const response = await chat(trimmed);
        console.log(`\nCoach: ${response}\n`);
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          console.error(`\nAPI Error (${error.status}): ${error.message}\n`);
        } else {
          throw error;
        }
      }

      askQuestion();
    });
  };

  askQuestion();
}

main();
