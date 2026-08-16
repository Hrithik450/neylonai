import { registerAgent } from "../../domain/registry";
import { mainAgent } from "./definition";

registerAgent(mainAgent);

export { mainAgent };
export {
  buildProactiveSuggestions,
  type BuildSuggestionsInput,
  type ProactiveSuggestion,
  type SuggestionSource,
} from "./proactive-suggestions";
