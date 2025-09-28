import { z } from "zod";

export const encoderSchema = z.object({
  queries: z.array(z.string()),
  texts: z.array(z.string()),
});

export interface Encodings {
  list: number[][];
}

export interface EncoderRequest {
  queries: string[];
  texts: string[];
}

export interface EcnoderResponse {
  success: boolean;
  data?: Encodings;
  error?: string;
}
