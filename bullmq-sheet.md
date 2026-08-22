## WorkerOptions:

| Option | وظيفتها | مثال |
|---|---|---|
| `connection` | Redis connection | `{ host, port }` |
| `concurrency` | عدد Jobs بالتوازي | `20` |
| `limiter` | Rate limiting | `{ max: 50, duration: 1000 }` |
| `autorun` | يبدأ Worker تلقائيًا | `true` |
| `name` | اسم للWorker | `'email-worker-1'` |
| `prefix` | Redis key prefix | `'my-app'` |
| `lockDuration` | مدة Lock على Active Job | `30000` |
| `lockRenewTime` | كل قد إيه يجدد Lock | `15000` |
| `skipLockRenewal` | يمنع التجديد التلقائي | `false` |
| `skipStalledCheck` | يمنع stalled checking | `false` |
| `stalledInterval` | فترة فحص stalled jobs | `30000` |
| `maxStalledCount` | كام مرة Job مسموح تبقى stalled | `1` |
| `drainDelay` | انتظار لو Queue فاضية | `5` |
| `runRetryDelay` | Delay عند transient worker loop errors | قيمة ms |
| `settings` | Advanced Worker settings | `{ ... }` |
| `metrics` | جمع Metrics | `{ maxDataPoints: ... }` |
| `useWorkerThreads` | Sandbox باستخدام worker threads | `true` |
| `workerForkOptions` | Options للchild process | `{ ... }` |
| `workerThreadsOptions` | Options للworker_threads | `{ ... }` |
| `skipVersionCheck` | تخطي Redis version validation | `true` |
| `skipWaitingForReady` | لا تنتظر Redis ready | `true` |
| `blockingConnection` | خيار connection قديم/داخلي في بعض الإصدارات | غالبًا لا تحتاجه |
| `telemetry` | Tracing/Telemetry | `{ ... }` |

## JobsOptions:

| Option | وظيفتها | مثال | النتيجة |
|---|---|---|---|
| `attempts` | عدد محاولات تنفيذ الـJob | `attempts: 5` | لو فشلت، تحاول لحد 5 مرات |
| `backoff` | الانتظار بين Retry | `{ type: 'exponential', delay: 1000 }` | يزيد وقت الانتظار تدريجيًا |
| `delay` | تأخير بدء الـJob | `delay: 60000` | تبدأ بعد دقيقة |
| `priority` | أولوية الـJob | `priority: 1` | Priority أقل رقميًا = أعلى بين prioritized jobs |
| `jobId` | ID مخصص للـJob | `jobId: 'order-123'` | مفيد للـidempotency ومنع إدخال نفس ID مرتين |
| `removeOnComplete` | حذف/الاحتفاظ بالـcompleted jobs | `true` أو `1000` | حذف فورًا أو الاحتفاظ بعدد |
| `removeOnFail` | حذف/الاحتفاظ بالـfailed jobs | `{ count: 5000 }` | يحتفظ بآخر 5000 Failed |
| `lifo` | استخدام Last-In-First-Out | `lifo: true` | أحدث Job تتقدم |
| `timestamp` | تحديد وقت إنشاء مخصص | `timestamp: Date.now()` | override للtimestamp الافتراضي |
| `stackTraceLimit` | عدد Stack traces المحفوظة | `stackTraceLimit: 10` | يقلل/يزيد تفاصيل أخطاء الـJob |
| `keepLogs` | عدد Logs المحفوظة للـJob | `keepLogs: 100` | يحتفظ بآخر 100 log |
| `sizeLimit` | أقصى حجم للـpayload | `sizeLimit: 1024 * 100` | يرفض data أكبر من الحد |
| `parent` | ربط Job بـParent في Flow | `{ id, queue }` | Child job تابعة لـParent |
| `failParentOnFailure` | فشل Parent لو Child فشلت | `true` | Parent تتأثر بفشل Child |
| `ignoreDependencyOnFailure` | تجاهل dependency لو Child فشلت | `true` | Parent ممكن تكمل |
| `removeDependencyOnFailure` | إزالة dependency عند الفشل | `true` | يفك ارتباط Child الفاشلة |
| `continueParentOnFailure` | يسمح للParent تكمل رغم الفشل | `true` | Flow تواصل التنفيذ |
| `deduplication` | منع Jobs متكررة حسب ID/strategy | `{ id: 'user-42' }` | يقلل duplicate processing |
| `telemetry` | Metadata للTracing/observability | `{ metadata: ... }` | تستخدم مع telemetry |
| `repeat` / scheduling-related options | تشغيل متكرر حسب الـAPI المستخدمة | حسب scheduler/repeat config | Jobs دورية |