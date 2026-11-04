import type { GlyphName } from "./types.ts";

const word = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");

/** De más específico a más general: la primera que coincide con el rótulo gana. */
const RULES: [GlyphName, RegExp][] = [
  ["cdn", word("cdn|cloudfront|akamai|fastly")],
  ["balancer", word("load ?balancer|balanceador|lb|nginx|haproxy|alb|elb|traefik")],
  ["gateway", word("api ?gateway|gateway|ingress|proxy|puerta de enlace|kong")],
  ["cache", word("cache|caché|redis|memcached|valkey")],
  ["queue", word("queue|cola|kafka|rabbit(?:mq)?|sqs|sns|pub ?sub|broker|topic|nats")],
  ["database", word("db|database|base de datos|postgres(?:ql)?|mysql|maria(?:db)?|mongo(?:db)?|sql|oracle|sqlite|cassandra|dynamo(?:db)?")],
  ["storage", word("s3|bucket|storage|blob|objetos|archivos|files|volume|volumen|minio")],
  ["function", word("lambda|function|función|funcion|serverless|worker|job|cron")],
  ["browser", word("browser|navegador|web ?app|frontend|spa")],
  ["phone", word("phone|mobile|móvil|movil|celular|ios|android|smartphone")],
  ["laptop", word("laptop|portátil|portatil|desktop|pc|notebook")],
  ["user", word("user|usuario|cliente|client|customer|actor|persona|people")],
  ["external", word("external|externo|third.?party|stripe|paypal|smtp|e-?mail|correo|mail|sendgrid|twilio|sms")],
  ["server", word("server|servidor|vm|host|nodo|node|instance|instancia")],
];

/** El objeto del catálogo que mejor le va a un rótulo («Postgres» es una base de datos, «Redis» un caché); `undefined` si no hay pista. */
export function inferGlyph(text: string): GlyphName | undefined {
  for (const [glyph, re] of RULES) if (re.test(text)) return glyph;
  return undefined;
}
