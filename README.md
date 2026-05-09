# CYBER//HUB

Мультитул в киберпанк-стиле: обрезка изображений, рулетка, промокоды Neverness to Everness.

---

## Деплой

### 1. Railway (рекомендуется)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

1. Подключите GitHub-репозиторий в Railway
2. Railway автоматически установит зависимости (`npm install`)
3. Сервер запустится на выданном домене `*.up.railway.app`

### 2. Подключение своего домена

#### Через Railway Dashboard

1. Откройте проект на [railway.app](https://railway.app)
2. Перейдите в **Settings → Networking**
3. Нажмите **Add Domain**
4. Введите ваше доменное имя (например `hub.example.com`)
5. Railway покажет **CNAME record** — скопируйте его значение

#### DNS-настройки у вашего регистратора

Добавьте DNS-запись в панели управления доменом:

| Тип   | Имя      | Значение                        | TTL     |
|-------|----------|---------------------------------|---------|
| CNAME | `hub`    | `自定义主机名.up.railway.app`     | Auto    |

> Если подключаете **корневой домен** (`example.com`) — добавьте **ALIAS/ANAME** запись
> или используйте **redirect** через NS-записи Cloudflare.

#### Пример для Cloudflare

1. Добавьте домен в Cloudflare
2. **DNS → Add record:**
   - **Type:** `CNAME`
   - **Name:** `hub` (или `@` для корневого)
   - **Target:** `ваш-домен.up.railway.app`
   - **Proxy status:** `DNS only` (для начала)
3. После проверки можно включить Proxy (оранжевый) — Railway поддерживает
4. Включите **SSL/TLS → Full** в настройках Cloudflare

#### DNS propagation

Изменения DNS могут обновляться от 5 минут до 48 часов. Проверить:
```
nslookup hub.example.com
dig hub.example.com
```

---

## Безопасность

Приложение защищено следующими механизмами:

| Защита | Описание |
|--------|----------|
| **Helmet CSP** | Content Security Policy — блокирует инъекции скриптов |
| **Rate limiting** | 120 req/min общий, 30 req/min API, 2 req/30sec обновление кодов |
| **Body size limit** | JSON/формы ограничены 100KB |
| **X-Frame-Options** | Запрещён iframe-встраивание |
| **X-Content-Type-Options** | Запрещено MIME-sniffing |
| **Referrer-Policy** | Отключён referrer |
| **CSP img-src** | Только `data:` и `blob:` для картинок |
| **CSP script-src** | Только `'self'` и `'unsafe-inline'` |

---

## Локальный запуск

```bash
npm install
npm start
```

Откройте [http://localhost:3000](http://localhost:3000)
