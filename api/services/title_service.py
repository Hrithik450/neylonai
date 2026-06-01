import json
from typing import Dict, Union
from langchain_openai import ChatOpenAI
from ..utils.prompts import title_prompt
from pydantic import BaseModel, ValidationError
from langchain_core.prompts import ChatPromptTemplate


class ThreadTitleSchema(BaseModel):
    user_input: str


class ThreadTitleResponse(BaseModel):
    success: bool
    data: Union[Dict[str, Union[str, list[str], dict]], None] = None
    error: str | None = None


class ThreadTitleService:

    llm = ChatOpenAI(
        model="gpt-4.1-nano",
        temperature=0.4,
        model_kwargs={"response_format": {"type": "json_object"}},
    )

    prompt = ChatPromptTemplate([("system", title_prompt), ("human", "{userMessage}")])

    @staticmethod
    async def create_title_for_threads(data: ThreadTitleSchema) -> ThreadTitleResponse:
        try:
            validated_data = ThreadTitleSchema(**data)
            user_input = validated_data.user_input

            if not user_input:
                return ThreadTitleResponse(
                    success=False, error="User message is required"
                )

            chain = ThreadTitleService.prompt | ThreadTitleService.llm
            response = await chain.ainvoke({"userMessage": validated_data.user_input})

            if not response.content:
                raise ValueError("Server is busy, try again later!")

            try:
                parsed_json = json.loads(response.content)
            except json.JSONDecodeError:
                raise ValueError("LLM did not return valid JSON")

            return ThreadTitleResponse(success=True, data=parsed_json)

        except ValidationError as ve:
            return ThreadTitleResponse(
                success=False, error=f"Validation error: {ve.errors()}"
            )
        except Exception as e:
            return ThreadTitleResponse(success=False, error=str(e))
