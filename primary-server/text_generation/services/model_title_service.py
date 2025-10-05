import json
from typing import Dict, Union
from langchain_openai import ChatOpenAI
from ..lib.utils import TITLE_SYSTEM_PROMPT
from pydantic import BaseModel, ValidationError
from langchain_core.prompts import ChatPromptTemplate

# --- Schema (equivalent to zod schema) ---
class ChatTitleSchema(BaseModel):
    user_message: str

# --- Response wrapper ---
class ChatTitleResponse(BaseModel):
    success: bool
    data: Union[Dict[str, Union[str, list[str], dict]], None] = None
    error: str | None = None

# --- Service class ---
class ChatTitleService:
    @staticmethod
    async def create_title_for_threads(data: ChatTitleSchema) -> ChatTitleResponse:
        try:
            # Validate input (like zod.parse)
            validated_data = ChatTitleSchema(**data)
            user_message = validated_data.user_message

            if not user_message:
                return ChatTitleResponse(success=False, error="User message is required")
            
            # Create LangChain LLM
            llm = ChatOpenAI(
                model="gpt-4.1-nano",
                temperature=0.4,
                model_kwargs={"response_format":{"type": "json_object"}}
            )

            # Prompt
            prompt = ChatPromptTemplate([
                ("system", TITLE_SYSTEM_PROMPT),
                ("human", "{userMessage}")
            ])

            formatted_prompt = prompt.invoke({"userMessage": validated_data.user_message})

            # Direct LLM call
            result = await llm.ainvoke(formatted_prompt)
            final_result = result.content

            if not final_result:
                raise ValueError("Server is busy, try again later!")
            
            try:
                parsed = json.loads(final_result)
            except json.JSONDecodeError:
                raise ValueError("LLM did not return valid JSON")
            
            return ChatTitleResponse(success=True, data=parsed)

        except ValidationError as ve:
            return ChatTitleResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatTitleResponse(success=False, error=str(e))