"""Current time and the local calendar used for streaks and the weekly ranking (Vietnam time by default).

Everything asks clock.now(), so tests can move time forward.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from learning_service.config import get_settings


def now() -> datetime:
    return datetime.now(UTC)


def zone() -> ZoneInfo:
    return ZoneInfo(get_settings().app_timezone)


def as_utc(moment: datetime) -> datetime:
    """SQLite (tests) gives back naive datetimes; they are stored in UTC."""
    return moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment.astimezone(UTC)


def local_date(moment: datetime) -> date:
    return as_utc(moment).astimezone(zone()).date()


def today() -> date:
    return local_date(now())


def start_of(day: date) -> datetime:
    """Local midnight at the start of `day`, in UTC."""
    return datetime.combine(day, time.min, tzinfo=zone()).astimezone(UTC)


def week_of(day: date) -> tuple[date, date]:
    """Monday and Sunday of the week containing `day`."""
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=6)
