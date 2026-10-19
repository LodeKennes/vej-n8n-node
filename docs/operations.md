# Operations and use cases

The **Vej** node exposes 33 actions. Each input item produces one paired output item containing the complete API response. A 204/empty response becomes `{}`. Errors fail the node unless n8n's **On Error → Continue** is selected; continued errors contain `error` and retain the originating item link.

## Native decisions

New nodes use **version 2**, with form controls by default. Add named outcomes and rubric levels as rows. **Predict Multiple Questions** offers Choice, Statement (Noul), and Score groups with repeatable questions; every question has its own ID. State, prompts, IDs, numeric values, and descriptions accept n8n expressions. Existing version 1 workflows continue using their stored JSON inputs.

All four actions call `POST /v1/predict`:

| Action | Inputs | Read the result |
| --- | --- | --- |
| Choose an Outcome | State, question, names mapped to descriptions | `answers.result.choice`, `answers.result.probabilities` |
| Assess a Statement | State, statement; optional criteria and outcome descriptions | `answers.result.noul`, `answers.result.probabilities` |
| Score Against a Rubric | State, question, ordered descriptions | `answers.result.score`, `answers.result.probabilities`, `answers.result.legend` |
| Predict Multiple Questions | State and repeatable Choice/Noul/Score questions | `answers.<your_question_id>` |

The guided actions use `result` as the default question ID; changing it changes the output path. Text and structured JSON state are supported. Names/descriptions are semantic inputs. Questions are independent, and Score uses zero-based indices. The node does not reinterpret scores as probabilities or combine marginal probabilities into a joint confidence.

## Eleven Beta workflows

Every action has a form: sources and document text; value bins and units; typed record fields; individual checks and dependencies; conversation history, messages, and sequence; calibration cohorts and reviewed events. The node constructs the API payload for you.

Calibration rows use **Reviewed Outcome Key**: enter the exact Choice outcome name, or `true` / `false` for a Noul question. The node derives the API's numeric target from the serialized outcome order, including numeric-looking Choice names.

The table below documents the resulting API fields. If you choose **Advanced JSON**, provide **only the object inside `input`**; the node adds `mode` automatically. Every action has an authored editable default. An expression may return an object directly. Structured arbitrary state and bulk request variants remain available through Advanced JSON.

Repeated form controls store a collection such as `{ "entries": [{ "name": "refund", "description": "Review a refund" }] }`. A question collection groups rows by kind: `{ "noul": [{ "id": "review", "prompt": "This needs review." }] }`. You can map these collections from earlier nodes rather than manually adding hundreds of calibration rows. These shapes describe expression mapping; ordinary form use does not require entering them.

| Use case | Action | Endpoint | Key input fields |
| --- | --- | --- | --- |
| Target error rate | Workflow → Target Error Rate | `POST /v1beta/predict` · `risk` | `binding`, one-question `request`, `calibration` token or `calibration_id` |
| Show the evidence | Workflow → Show the Evidence | `POST /v1beta/alignments` | `question`, `sources: [{id,text}]` |
| Number with a range | Workflow → Estimate a Number with a Range | `POST /v1beta/predict` · `estimate` | text `state`, `questions` with `type: estimate`, `unit`, increasing `values` |
| Label every part of a document | Workflow → Label a Document | `POST /v1beta/annotate` | `document`, `questions`, either `segment` or explicit `segments` |
| Watch a conversation | Conversation → Create / Append / Query | `POST /v1beta/states` or `/{id}/events` | `operation`, `expected_seq`, history/event, optional `questions` |
| Use your corrections | Feedback → Use Your Corrections | `POST /v1beta/feedback` | `binding`, `target_error_rate`, `events`, optional `persist` |
| If so, then… | Workflow → Ask a Conditional Question | `POST /v1beta/predict` · `given` | `state`, `first`, `first_outcome`, typed `condition`, `conditional` |
| Pick the correct record | Workflow → Pick the Correct Record | `POST /v1beta/predict` · `bind` | `state`, `question`, `records: [{id,name,description,fields?}]` |
| Step-by-step checks | Workflow → Run Step-by-Step Checks | `POST /v1beta/flows` | `state`, `steps`, optional `inputs`, `previous_results`, `recompute` |
| Rank with probabilities | Workflow → Rank with Probabilities | `POST /v1beta/rankings` | text `state`, `question`, `candidates`, `top_k` |
| Select effort | Workflow → Select Effort | `POST /v1beta/predict` · `effort` | `state`, `questions` with per-question `effort` |

For details and current limits, read [Vej's use cases](https://itsvej.com/use-cases/). Beta capability is not a guarantee of quality or production promotion.

### Evidence and document offsets

Offsets are Unicode code points with an exclusive end. JavaScript strings use UTF-16 indices. To display a source span in an n8n Code node:

```javascript
const text = Array.from(sourceText).slice(start, end).join('');
```

The caller supplies and owns the original source. No evidence selected means `no_evidence`; it does not prove the claim false. Annotation supports `word`, `line`, `paragraph`, or caller-supplied spans. Sentence segmentation uses explicit spans. Full documents are re-read for each candidate; word-level annotation can be expensive and longer inputs fail rather than truncate.

### Conversation sequence

First explicitly enable states retention through **Retention → Set Retention Consent** as an organization administrator. The node never changes consent as a side effect of inference.

Create uses `operation: create`, `expected_seq: 0`, and `history`; the response includes `id` and `seq`. Map `id` to the next node's **ID**. For append, send `operation: event`, `expected_seq` equal to the returned `seq`, and a nonempty `event`. Query omits `event` but also advances `seq`. Get Conversation Metadata reads without inference and returns the current sequence. Delete requires the expected sequence in its separate field.

In the form, use **Initial History** to create, **New Message** to append, and **Expected Sequence** for append/query. The node supplies `operation` and the create sequence automatically. The conversation example maps the ID and sequence using individual expression fields.

A stale sequence returns 409. After a timeout, read metadata and inspect your own event history before deciding whether to retry; a timeout does not prove that the append failed. A `rebuild_needed` response requires a new state created from caller-owned history. Retention revocation and expiry remain server-controlled.

### Risk, calibrations, and feedback

Fit a Calibration sends native labeled requests to `/v1beta/calibrations`, separating `temperature_fit` from `risk_fit`. The example is a **shape illustration**, with placeholder digests and insufficient data for risk qualification. Use your own population fingerprint and independent data; at least 500 independent risk-fit groups are required. The server supplies checkpoint/runtime binding in its fit result; keep the returned binding with the token or stored ID. A nominal target and passing sample do not establish a deployment-population error guarantee.

Get/Delete a Stored Calibration use `/v1beta/calibrations/{id}`. Read/Delete a Calibration Token POST the token and binding to `/v1beta/calibrations`; the node supplies the matching `action`. Signed tokens are transient by default. Durable storage requires explicit retention consent and `persist: true`.

Feedback uses reviewed labels, original native logits, candidate identities, and separate group roles (`temperature-fit`, `risk-fit`, `check`). It fits temperature/threshold with frozen weights; corrections do not automatically retrain the model. Unverified fits can have a null threshold and abstain. Delete Retained Feedback calls `DELETE /v1beta/feedback/{id}` and invalidates derived fits. Retention consent for feedback is separate from calibrations.

### Conditional questions, binding, flows, effort, and rankings

Conditional Noul assumptions use JSON booleans; Choice assumptions use option-name strings. A bound product is modeled conditional composition, without a causal or independence guarantee. Unbound conditions retain `product: null`.

Record matching preserves caller IDs and typed fields, including false, null, and zero. An absent result concerns the supplied list. Flows run no external tools. To resume, resend the same steps, required inputs, and `previous_results`; earlier results are caller assertions unless `recompute: true` reruns them.

Standard effort executes. Fast/careful results remain explicitly unavailable, even with HTTP 200; the node preserves all statuses without fallback. Rankings are Beta with a failed quality gate and may be unavailable without a qualified sidecar. `p_best` and `p_top_k` have distinct semantics.

## Supporting resources

| Resource | Actions | Route |
| --- | --- | --- |
| Retention | Get / Set Retention Consent | `GET/PUT /v1beta/retention/{api}` |
| Batch | Create / Get / Cancel | `POST /v1/batches`, `GET /v1/batches/{id}`, `POST /v1/batches/{id}/cancel` |
| Account | Get Account / List Models / Get Usage | `GET /v1/me`, `/v1/models`, `/v1/usage` |

Retention changes require organization-admin scope. Enabling consent does not make an unavailable feature available. Disabling consent schedules erasure according to server lifecycle rules.

Batch JSON uses `endpoint` and `shards` containing pre-signed `input_url`/`output_url`. The hosted service currently lacks configured approved EU storage hosts, so execution is not open. The node never signs URLs, downloads data, polls jobs, or changes storage policy. Usage accepts `7d`, `30d`, or `90d` and an optional model filter; this filter does not select an inference model.

The node uses Vej's native API. Jev/Cloudflare-compatible routes express the same primitive decisions; this package exposes native shapes rather than duplicating those wire formats. Account API-key creation/revocation and access-request administration remain in the Vej console.
