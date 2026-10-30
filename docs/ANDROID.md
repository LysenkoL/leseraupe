# ANDROID — сборка приложения на Windows

Как собрать Leseraupe для телефона (debug-APK) и для Google Play (подписанный `.aab`).
Статус публикации — в `docs/PLAY.md`.

## 0. Один раз: что должно быть установлено

- Android Studio (в ней уже есть Android SDK и Java; отдельную Java ставить не нужно).
- Node.js, в папке проекта один раз выполнить `npm install`.
- Для команд в терминале (PowerShell) указать Java из Android Studio — в каждом новом окне:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

> Android Studio может предложить «Upgrade Android Gradle Plugin». Пока **не соглашаться**:
> версии подобраны так, чтобы работать с Java 25 из Android Studio (Gradle 9.1).

## 1. После каждого изменения кода

```powershell
npm run android
```

Это собирает веб-часть для Android (`build:play`: без service worker, без кнопки установки)
и копирует её в папку `android/`. Без этого шага в приложении останется старая версия.

## 2. Debug-APK на свой телефон

Debug-версия подписана автоматически (временным ключом Android Studio) и годится только для проверки.

**Способ A — по кабелю (удобнее всего):**
1. На телефоне: Настройки → О телефоне → 7 раз нажать «Номер сборки» → появятся «Для разработчиков».
2. Настройки → Для разработчиков → включить «Отладка по USB».
3. Подключить телефон кабелем, на телефоне разрешить отладку для этого компьютера.
4. Android Studio → **File → Open** → папка `C:\Projekte\leseraupe\android`.
5. Сверху выбрать свой телефон и нажать зелёный ▶ **Run**.

**Способ B — файлом:**
1. Android Studio → **Build → Generate App Bundles or APKs → Generate APKs**
   (или в терминале: `cd android` → `.\gradlew assembleDebug`).
2. Файл: `android\app\build\outputs\apk\debug\app-debug.apk`.
3. Перенести на телефон (Google Drive, кабель), открыть, разрешить «Установка из неизвестных источников».

> **Важно:** debug-версия и версия из Google Play подписаны разными ключами.
> Чтобы потом поставить версию из Play, debug-версию придётся удалить — **вместе с данными**.
> Перед этим: «Einstellungen → Sicherung speichern».

## 3. Ключ подписи — создать ОДИН раз

Google Play использует «Play App Signing»: Google хранит настоящий ключ приложения,
а мы подписываем загрузки **ключом загрузки (upload key)**. Его и создаём.

1. Создать папку **вне проекта**, например `C:\Users\<имя>\Keys\`.
2. Android Studio → **Build → Generate Signed App Bundle or APK → Android App Bundle → Next**
   → «Key store path» → **Create new…**:
   - Key store path: `C:\Users\<имя>\Keys\leseraupe-upload.jks`
   - Password: придумать (длинный, записать сразу)
   - Alias: `upload`
   - Key password: можно тот же
   - Validity (years): `30`
   - Certificate: First and Last Name — имя разработчика; остальное можно пусто, Country Code `DE`
   - **OK**, затем окно мастера можно закрыть (`Cancel`) — ключ уже создан.

   То же самое в терминале:

   ```powershell
   & "$env:JAVA_HOME\bin\keytool" -genkeypair -v -keystore "$HOME\Keys\leseraupe-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10950
   ```

3. Создать файл `android\key.properties` (он в `.gitignore`, в git **не попадёт**).
   Пути — с прямыми слешами `/`:

   ```properties
   storeFile=C:/Users/<имя>/Keys/leseraupe-upload.jks
   storePassword=ПАРОЛЬ
   keyAlias=upload
   keyPassword=ПАРОЛЬ
   ```

Проверить, что файл не попадёт в git: `git status` — `key.properties` и `.jks` там видны быть **не должны**.

### Что сохранить в резервную копию (обязательно)

| Что | Где хранить |
|---|---|
| Файл `leseraupe-upload.jks` | 2 места: например, USB-флешка + облако (Google Drive личный) |
| Пароль хранилища и пароль ключа | менеджер паролей (не рядом с файлом в открытом виде) |
| Alias (`upload`) | там же, рядом с паролями |
| Файл `key.properties` | не обязательно — его легко создать заново по таблице выше |

Без ключа загрузки новые версии в Play не загрузить. Если ключ всё же потерян —
в Play Console можно запросить «Upload key reset» (через поддержку, занимает несколько дней).
**Никогда** не класть ключ, пароли и `key.properties` в git, в чат или в письма.

## 4. Подписанный `.aab` для Google Play

```powershell
npm run android
cd android
.\gradlew bundleRelease
```

Результат: `android\app\build\outputs\bundle\release\app-release.aab` — его загружать в Play Console.

Если `key.properties` нет, `.aab` получится **неподписанным** и Play его не примет.

Альтернатива без терминала: Android Studio → **Build → Generate Signed App Bundle or APK**
→ Android App Bundle → выбрать `.jks`, alias, пароли → **release** → Create.

## 5. Версии

| Что | Где | Сейчас |
|---|---|---|
| `versionName` (видна пользователям и в «Über die App») | `package.json` → `"version"` | `1.0.0` |
| `versionCode` (число для Play, только растёт) | `android\app\build.gradle` → `versionCode` | `1` |

При **каждой** новой загрузке в Play: `versionCode` +1 (2, 3, …), `version` по смыслу (`1.0.1`, `1.1.0`).

## 6. Проверить на телефоне перед загрузкой

- Печать: 1, 3 и 5 листов → в диалоге «ISO A4», число страниц совпадает; отмена печати ничего не ломает.
- «Als PDF teilen» → открывается меню «Teilen», PDF открывается и выглядит как лист.
- Чтение с экрана и таймер: экран не гаснет; в конце таймера вибрация.
- Ссылки: почта, Claude/ChatGPT, Datenschutz — открываются вне приложения после вопроса для родителей.
- Перенос из веб-версии: в браузере «Sicherung speichern» → в приложении «Sicherung laden» → листы, протокол, Stolperwörter, бусины на месте.
- Закрыть приложение и открыть снова — данные на месте.
