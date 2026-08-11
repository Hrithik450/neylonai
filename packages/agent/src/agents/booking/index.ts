import { registerAgent } from "../../domain/registry";
import { bookingAgent } from "./definition";

registerAgent(bookingAgent);

export { bookingAgent };
