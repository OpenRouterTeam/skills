import re


EMAIL_PATTERN = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+"
    r"@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$"
)


def is_valid_signup_email(value: object) -> bool:
    """Return True for a syntactically valid signup email address."""
    return isinstance(value, str) and len(value) <= 254 and EMAIL_PATTERN.fullmatch(value) is not None


if __name__ == "__main__":
    assert is_valid_signup_email("first.last@example.com")
    assert is_valid_signup_email("user+tag@sub.example.co")
    assert not is_valid_signup_email("")
    assert not is_valid_signup_email("missing-domain@")
    assert not is_valid_signup_email("two@@example.com")
    assert not is_valid_signup_email("user@example..com")
    assert not is_valid_signup_email("user@-example.com")
    assert not is_valid_signup_email(123)
