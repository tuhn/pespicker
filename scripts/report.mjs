// Regenerate DATA_REPORT.md without fetching anything (e.g. after editing overrides.json or STAR_THRESHOLDS).
import { writeReport } from './lib/report.mjs';

const { quantiles } = writeReport();
console.log('DATA_REPORT.md updated. Quantile thresholds:', quantiles?.join(', '));
