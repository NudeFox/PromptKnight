# Privacy

PromptKnight processes pasted plain text locally on pages where you enable it. Text
is read from the individual paste event, not a clipboard history or background monitor.
No clipboard-read permission is requested.

Clipboard text, findings and previews are not stored persistently, transmitted to a
server, logged or sent to the background worker. There is no analytics, telemetry,
account or backend. Pending text is released after a choice, cancellation, disable
or navigation; JavaScript cannot guarantee immediate erasure from memory.

The warning displays a redacted preview. Choosing Paste original or Paste redacted
makes that chosen text available to the destination website, which may process it
according to its own policies. Detection can miss sensitive data.

Temporary page access is granted when you invoke the extension from the toolbar.
Only the page you enable is injected; no persistent host access is requested. Browser
restricted pages and frames are unsupported. Development tooling and dependency
installation may use the network; the production extension has no runtime network
functionality.
