import {Configuration}                     from './Configuration';
import {MessageName, stringifyMessageName} from './MessageName';
import {Report}                            from './Report';

export enum LogLevel {
  ERROR = `error`,
  WARNING = `warning`,
  INFO = `info`,
  DISCARD = `discard`,
}

type FindLogLevel = (name: MessageName | null, text: string, defaultLevel: LogLevel) => LogLevel;

const useDefaultLogLevel: FindLogLevel = (name, text, level) => level;

export abstract class ConfigurableReport extends Report {
  private findLogLevel: FindLogLevel;

  constructor(configuration: Configuration) {
    super();

    const logFilter = configuration.get(`logFilter`);

    if (logFilter.size === 0) {
      this.findLogLevel = useDefaultLogLevel;
    } else {
      const logFilterByRegExp = Array.from(logFilter)
        .filter(([key]) => !/^YN\d{4}$/.test(key))
        .map(([key, level]) => [new RegExp(key), level] as const);

      this.findLogLevel = (name, text, defaultLevel) => {
        if (name != null) {
          const levelByName = logFilter.get(stringifyMessageName(name));

          if (typeof levelByName !== `undefined`) {
            return levelByName ?? defaultLevel;
          }
        }

        for (const [regExp, logLevel] of logFilterByRegExp) {
          if (regExp.test(text)) {
            return logLevel ?? defaultLevel;
          }
        }

        return defaultLevel;
      };
    }
  }

  abstract writeReportInfo(name: MessageName | null, text: string): void;
  abstract writeReportWarning(name: MessageName, text: string): void;
  abstract writeReportError(name: MessageName, text: string): void;

  writeReportLevel(level: LogLevel, name: MessageName | null, text: string): void {
    switch (this.findLogLevel(name, text, level)) {
      case LogLevel.INFO:
        this.writeReportInfo(name, text);
        break;
      case LogLevel.WARNING:
        this.writeReportWarning(name ?? MessageName.UNNAMED, text);
        break;
      case LogLevel.ERROR:
        this.writeReportError(name ?? MessageName.UNNAMED, text);
        break;
    }
  }

  reportInfo(name: MessageName | null, text: string): void {
    this.writeReportLevel(LogLevel.INFO, name, text);
  }

  reportWarning(name: MessageName, text: string): void {
    this.writeReportLevel(LogLevel.WARNING, name, text);
  }

  reportError(name: MessageName, text: string): void {
    this.writeReportLevel(LogLevel.ERROR, name, text);
  }
}
