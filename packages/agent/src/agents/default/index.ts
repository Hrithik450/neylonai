import { registerAgent } from "../../domain/registry";
import { neylonaiChatbotAgent } from "./definition";

registerAgent(neylonaiChatbotAgent);

export { neylonaiChatbotAgent };
export {
  buildProactiveSuggestions,
  type BuildSuggestionsInput,
  type ProactiveSuggestion,
  type SuggestionSource,
} from "./proactive-suggestions";
