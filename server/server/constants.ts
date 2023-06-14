export default {
    VERSION: "1.1.6",
    DATA_DIR: "data",
    PROJECTS_DIR: "projects",
    RENDERS_DIR: "renders",
    TEMP_DIR: "temp",
    THUMBNAIL_DIR: "thumbnails",
    DEFAULT_THUMBNAIL_NAME: "thumbnail.jpg",
    THUMBNAIL_WIDTH: 256,
    THUMBNAIL_RECHECK_INTERVAL: 1000 * 60, // one minute
    HEARTBEAT_INTERVAL: 1000 * 60, // one minute
    TASK_WAIT_TIME: 1000 * 60, // one minute
    MAX_PROJ_ERRORS: 15, // maximum errors that can occur from a project before ditching it,
    WORKER_LOG_NEWLINE_LENGTH: 50, // remember the previous 50 lines of the log per worker
    BCRYPT_SALT_ROUNDS: 16,
    LOG_BUFFER_LINES: 50 // lines to keep in log arrau
}