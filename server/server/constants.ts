export default {
    VERSION: "1.1.0",
    DATA_DIR: "data",
    PROJECTS_DIR: "projects",
    RENDERS_DIR: "renders",
    TEMP_DIR: "temp",
    HEARTBEAT_INTERVAL: 1000 * 60, // one minute
    TASK_WAIT_TIME: 1000 * 60, // one minute
    MAX_PROJ_ERRORS: 15, // maximum errors that can occur from a project before ditching it,
    WORKER_LOG_NEWLINE_LENGTH: 50 // remember the previous 50 lines of the log per worker
}