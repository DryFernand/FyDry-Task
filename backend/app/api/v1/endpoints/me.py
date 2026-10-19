from fastapi import APIRouter, Depends
from app.api.deps import CurrentUser, get_current_user

router = APIRouter()


@router.get("/me", response_model=CurrentUser, summary="Usuario de FyDry autenticado")
def read_me(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return current_user
