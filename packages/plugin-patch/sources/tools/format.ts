import {miscUtils, Report, formatUtils, MessageName, Configuration} from '@yarnpkg/core';

import {Hunk, PatchMutationType}                                    from './parse';

export function reportHunk(hunk: Hunk, {configuration, report}: {configuration: Configuration, report: Report}) {
  for (const part of hunk.parts) {
    for (const line of part.lines) {
      switch (part.type) {
        case PatchMutationType.Context: {
          report.reportInfo(null, `  ${formatUtils.pretty(configuration, line, `grey`)}`);
        } break;

        case PatchMutationType.Deletion: {
          report.reportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `- ${formatUtils.pretty(configuration, line, formatUtils.Type.REMOVED)}`);
        } break;

        case PatchMutationType.Insertion: {
          report.reportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `+ ${formatUtils.pretty(configuration, line, formatUtils.Type.ADDED)}`);
        } break;

        default: {
          miscUtils.assertNever(part.type);
        }
      }
    }
  }
}
