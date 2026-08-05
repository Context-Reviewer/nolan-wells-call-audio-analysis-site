# Validation results

Browser validation reports are stored in this directory after they have been
run and imported.

A report is complete only when:

- deterministic tests have run;
- live routing and filter tests have run;
- the loop-boundary test has run;
- no result remains `pending`;
- failures have been investigated and documented.

Use:

```powershell
.\tools\forensic-methods\Import-ValidationReport.ps1 `
    -ReportPath "C:\Users\lwpar\Downloads\browser-audio-validation-....json"
```
