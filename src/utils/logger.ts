import util from 'util';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  },
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
  },
};

const log = (message: any, color: string = colors.fg.white, icon: string = ''): void => {
  const formattedMessage = typeof message === 'string' ? message : util.inspect(message, { colors: true, depth: null });
  console.log(`${color}${icon ? icon + ' ' : ''}${formattedMessage}${colors.reset}`);
};

const logger = {
  info: (message: any): void => log(message, colors.fg.cyan, 'ℹ'),
  success: (message: any): void => log(message, colors.fg.green, '✔'),
  warn: (message: any): void => log(message, colors.fg.yellow, '⚠'),
  error: (message: any): void => log(message, colors.fg.red, '✖'),
  debug: (message: any): void => {
    if (process.env.NODE_ENV === 'development') {
        log(message, colors.fg.magenta, '⚙');
    }
  },
  start: (message: any): void => log(message, colors.fg.blue, '🚀'),
  done: (message: any): void => log(message, colors.fg.green, '🎉'),
  plain: (message: any): void => console.log(message),
};

export default logger;
