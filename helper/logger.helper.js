const fs = require('fs');
const path = require('path');

const getLogFilePath = (logType) => {
  const date = new Date().toISOString().split('T')[0];
  const logDir = path.join(__dirname, '../storage/logs', logType);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  return path.join(logDir, `${date}.log`);
};

const writeLog = (logType, message) => {
  const timestamp = new Date().toISOString();
  const logFilePath = getLogFilePath(logType);
  const logMessage = `[${timestamp}] ${message}\n`;
  
  fs.appendFileSync(logFilePath, logMessage);
};

const logger = {
  error: (message) => writeLog('error', message),
  info: (message) => writeLog('info', message),
  debug: (message) => writeLog('debug', message),
  access: (message) => writeLog('access', message)
};

module.exports = logger;
