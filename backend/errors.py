class UserFacingError(Exception):
    """An error whose message was written for the end user and is safe to relay.

    Raised on GPU workers for validation/load failures; poll_job passes the
    message through to the client verbatim. Anything else that escapes a job is
    reported as a generic internal error — raw library/exception text must never
    leak (see TestPollJob.test_error_state).

    Modal re-raises the worker's original exception type in the web container
    when the class is importable there; this module ships with the app source in
    both images, so isinstance checks work across the wire. Keep it
    message-only — extra attributes may not survive serialization.
    """
