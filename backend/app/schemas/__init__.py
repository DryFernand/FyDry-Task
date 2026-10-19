from pydantic import BaseModel, ConfigDict


class CoreSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


__all__ = ["CoreSchema"]
