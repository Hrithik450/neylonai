import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
} from "@huggingface/transformers";
import { unstable_cache } from "next/cache";
import { EncoderRequest, encoderSchema } from "@/actions/encoder.types";

export class EncoderService {
  static model_name: string = "Xenova/ms-marco-MiniLM-L-6-v2";

  // Load model + tokenizer, cached across requests
  static loadModel = unstable_cache(
    async () => {
      const model = await AutoModelForSequenceClassification.from_pretrained(
        EncoderService.model_name,
        { dtype: "q8" }
      );

      const tokenizer = await AutoTokenizer.from_pretrained(
        EncoderService.model_name
      );

      return { model, tokenizer };
    },
    ["encoder-model"],
    { revalidate: false }
  );

  static async encode(data: EncoderRequest) {
    try {
      const { queries, texts } = encoderSchema.parse(data);

      if (queries.length !== texts.length)
        return {
          success: false,
          error: "queries and texts must be arrays of equal length",
        };

      const { model, tokenizer } = await EncoderService.loadModel();

      const features = tokenizer(queries, {
        text_pair: texts,
        padding: true,
        truncation: true,
      });
      const output = await model(features);

      return {
        success: true,
        data: { list: output.logits.tolist() },
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get the ranking for pairs",
      };
    }
  }
}
