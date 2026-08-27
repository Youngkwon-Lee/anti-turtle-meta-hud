# Anti Turtle Meta HUD

[English](README.md) | [한국어](README.ko.md)

[![CI](https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/actions/workflows/ci.yml/badge.svg)](https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/actions/workflows/ci.yml)

[영문 음성 프로젝트 데모를 YouTube에서 보기](https://youtu.be/k-gM6kyfsp4)

Meta Display 글래스용 자세 코칭 HUD, 브라우저 카메라 HUD, macOS 알림과 메뉴 막대 상태 표시를 포함한 오픈소스 프로토타입입니다.

안경의 방향 센서를 이용해 **개인별 중립 머리 기울기 기준선**을 설정합니다. 릴레이 API를 통해 같은 세션 이름을 사용하는 다른 브라우저나 동료의 Mac에서 최신 HEAD/HYBRID 상태를 확인할 수 있습니다.

> 이 프로젝트는 웰니스 및 연구용 프로토타입입니다. 임상적 두개척추각(CVA)을 측정하거나 전방머리자세를 진단하지 않으며, 전문가의 평가를 대신하지 않습니다.

## 주요 기능

- 600×600 Meta Display HUD와 해부학적 Lottie 자세 애니메이션
- 준비 단계와 연속 3초 안정 보정, 머리 방향 중앙값 기반의 개인 기준선
- HEAD 단독 모드와 HEAD + 몸통 HYBRID 릴레이 모드
- Mac/데스크톱 실시간 카메라 HUD
- Redis를 지원하는 세션 분리형 순서 보장 telemetry
- 별도 의존성 없는 macOS 알림 센터 수신기와 메뉴 막대 실시간 각도
- Node 및 Python 테스트

## 빠른 시작

요구 사항: Node.js 20 이상, 선택적인 Mac 알림 테스트에는 Python 3.10 이상이 필요합니다.

```bash
npm test
npm run check
npm start
```

센서 없이 HUD를 미리 보려면 <http://127.0.0.1:3000/?demo=1&source=head>를 여세요.

## Meta AI에 웹앱 추가하기

이 과정은 **Web apps를 지원하는 Meta Display Glasses**가 필요합니다. 일반 Ray-Ban Meta 카메라는 보통의 웹페이지에 카메라 장치로 노출되지 않습니다.

### 방법 A — QR 코드 한 번 스캔하기

안경이 연결된 휴대전화로 아래 QR 코드를 스캔하세요. Meta AI 앱이 열리며 안정적인 공개 웹앱 주소를 추가할 수 있습니다.

![Meta AI 앱에서 Anti Turtle Meta HUD를 추가하는 QR 코드](docs/meta-ai-webapp-qr.png)

QR 코드는 기본 `head-demo` 세션을 사용합니다. 공개 데모 릴레이에는 인증이 없으므로 여러 사람이 동시에 시험할 때는 개인정보가 없는 고유한 세션 이름을 직접 입력하세요.

### 방법 B — 직접 추가하기

1. 안경이 연결된 휴대전화에서 **Meta AI 앱**을 엽니다.
2. **Devices → Display Glasses settings**로 이동합니다.
3. **App connections → Web apps → Add a web app**을 엽니다.
4. 이름에 `Anti Turtle Meta HUD`를 입력합니다.
5. 주소에 `https://stage-codex-bridge-head-only.vercel.app/?headonly=1&session=team_demo`를 입력합니다. `team_demo`는 Mac에서도 동일하게 사용할 개인정보 없는 세션 이름으로 바꾸세요.
6. 웹앱을 저장한 뒤 안경에서 실행합니다.
7. **START HEAD IMU**를 선택하고, 요청이 표시되면 Motion & Orientation 권한을 허용합니다. 편안한 중립 자세로 보정이 완료될 때까지 유지하세요.
8. Mac에서 같은 세션 이름을 사용해 `https://stage-codex-bridge-head-only.vercel.app/?camera=1&source=head&session=team_demo`를 엽니다.

Mac 카메라는 실시간 영상 배경을 제공하고 안경은 보정된 머리 방향 telemetry를 전송합니다. 메뉴 막대 앱에 `○ --`가 표시되면 두 장치의 세션 이름이 같은지, 안경의 **START HEAD IMU**가 계속 실행 중인지 확인하세요.

## HEAD 단독 실시간 연결

모든 장치에서 개인정보가 없는 동일한 세션 이름을 사용하세요.

```text
# 안경 송신기
https://YOUR_DEPLOYMENT.example/?headonly=1&session=team_demo

# Mac 카메라 수신기
https://YOUR_DEPLOYMENT.example/?camera=1&source=head&session=team_demo
```

안경에서 **START HEAD IMU**를 선택하고 편안한 중립 자세로 움직이지 않은 채 3초간 유지하세요. 움직임이 감지되면 보정이 다시 시작되고, 성공하기 전까지 값은 `--°`로 유지됩니다. 센서 신호가 끊기거나 착용 위치가 크게 바뀌면 다시 보정해야 합니다. 수신기는 최신 `HEAD/head-relay` 패킷만 허용하며 송신이 중단되면 stale 상태로 전환됩니다.

안경의 외부 카메라는 일반 웹 카메라로 노출되지 않습니다. 카메라 수신기 주소는 해당 페이지를 연 Mac이나 휴대전화의 카메라를 사용합니다.

## macOS 알림과 메뉴 막대

카메라 HUD를 열지 않고도 동료의 Mac에서 기본 알림을 받을 수 있습니다.

```bash
python3 macos/anti_turtle_notify.py \
  --base-url https://YOUR_DEPLOYMENT.example \
  --session team_demo \
  --mode HEAD \
  --notify-recovery
```

기본 정책은 500ms마다 상태를 확인하고, 오래된 telemetry를 무시하며, 경고 상태가 3초간 이어지면 알림을 보냅니다. 같은 알림은 30초 동안 반복하지 않으며 telemetry를 로컬에 저장하지 않습니다.

메뉴 막대에서 실시간 각도를 계속 보려면 다음 명령으로 설치하고 실행하세요. 전체 Xcode 앱은 필요 없으며 macOS Command Line Tools로 설치할 수 있습니다.

```bash
zsh macos/install_menu_bar.sh
open "$HOME/Applications/Anti Turtle Menu.app" --args \
  --base-url https://stage-codex-bridge-head-only.vercel.app \
  --session head-demo \
  --mode HEAD
```

메뉴 막대 각도를 클릭하면 연결 상태를 확인하고, 동일한 카메라 HUD를 열고, 알림을 켜거나 끄고, 앱을 종료할 수 있습니다. 사용자 지정 세션, HYBRID 모드, dry-run 알림과 문제 해결은 [macOS 상세 문서](macos/README.md)를 참고하세요.

## HYBRID 모드

HEAD + 몸통 실험을 진행하려면 다음 순서를 따르세요.

1. `public/torso-bridge.html`을 통해 NU/몸통 데이터를 릴레이합니다.
2. 안경에서 `/?hybrid=1&session=team_demo`를 엽니다.
3. Mac에서 `/?camera=1&source=ble&session=team_demo`를 엽니다.
4. 선택적인 Mac 알림에는 `--mode HYBRID`를 사용합니다.

## 향후 연구 방향

다음 측정 연구는 현재의 머리 기울기 코칭 값과 분리해 진행합니다.

- 독립적인 상체 IMU를 추가하고 안경 IMU와 융합해 머리 움직임과 몸통 기울기를 구분합니다.
- 표준화된 측면 영상에서 귀/이주, 어깨/견봉, 수동 확인 또는 검증된 C7 관련 랜드마크를 이용하는 Pose Estimation 절차를 연구합니다.
- 센서 연속성, 보정 품질, 카메라 기하, 랜드마크 신뢰도와 가시성을 결합하고 신뢰도가 부족하면 값을 표시하지 않습니다.
- CVA 및 전방머리자세 후보 추정치를 주석이 달린 기준 측정값과 비교하고 측정 오차, 반복성, 일치도, 지연과 실패 사례를 보고합니다.
- 임상가가 검토한 McKenzie 방식의 경추 신전 코칭을 선택적 운동 모듈로 연구합니다. 중단 지침과 금기 안내를 포함하며 자동 치료나 의료 처방으로 제공하지 않습니다.

얼굴과 어깨 keypoint는 복합 자세 추정에 도움을 줄 수 있지만 일반적인 Pose Estimation 모델은 C7을 직접 식별하지 못합니다. 표준화된 절차와 검증 없이는 임상적 CVA 정확도를 주장할 수 없습니다. 사진 기반 CVA 연구는 일반적으로 이주와 C7 랜드마크를 사용합니다. 관련 [CVA 측정 검증 연구](https://pubmed.ncbi.nlm.nih.gov/32911612/)와 [McKenzie 운동 관련 소규모 비교 연구](https://pubmed.ncbi.nlm.nih.gov/30154609/)를 참고하세요. 상세 검증 조건은 [연구 로드맵](docs/ROADMAP.md)과 [임상적 한계](docs/CLINICAL_LIMITS.md)에 정리되어 있습니다.

## 배포

이 저장소는 Vercel과 호환됩니다. `vercel.json`에서 Git 자동 배포를 비활성화했으며, 릴리스는 로컬에서 빌드한 결과물만 `vercel deploy --prebuilt`로 업로드해야 합니다. 공유 릴레이에는 다음 Redis REST 호환 환경 변수 한 쌍이 필요합니다.

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

기존 Vercel KV 이름인 `KV_REST_API_URL`과 `KV_REST_API_TOKEN`도 지원합니다. Redis가 없으면 로컬 개발에서만 프로세스 메모리를 사용합니다.

`OPENAI_API_KEY`는 선택 사항이며 서버의 코칭 문구 API에서만 사용합니다. 브라우저 코드에는 절대 포함하지 마세요.

## 개인정보 보호와 보안

데모 릴레이에는 인증이 없습니다. 배포 주소와 세션 이름을 아는 사람은 수명이 짧은 최신 telemetry를 읽을 수 있습니다.

- 이름, 이메일, 환자 ID 등 개인정보를 세션 이름으로 사용하지 마세요.
- 공개 데모 배포에 임상 또는 실제 서비스용 건강 데이터를 전송하지 마세요.
- 실제 서비스 전에는 인증·인가, 암호화 정책, 보존 및 삭제 통제, 사용자별 채널을 적용해야 합니다.
- 보안 문제는 [SECURITY.md](SECURITY.md)에 따라 제보해 주세요.

## 임상적 한계

머리 방향은 CVA가 아닙니다. 안경의 IMU만으로는 이주나 C7 위치를 찾을 수 없으며, 별도의 기준 센서가 없으면 목의 전방 이동과 몸 전체의 기울기를 안정적으로 구분하기 어렵습니다. 이 프로토타입의 임계값은 코칭용 기본값이지 진단 기준이 아닙니다. 자세한 내용은 [docs/CLINICAL_LIMITS.md](docs/CLINICAL_LIMITS.md)를 참고하세요.

## 프로젝트 상태

이 프로젝트는 실험용 프로토타입입니다. 장치 지원, 브라우저 센서 권한, Meta Display Web App 동작은 변경될 수 있습니다. 릴리스에 의존하기 전에 대상 안경과 운영체제에서 직접 시험하세요.

현재 공개 마일스톤은 연구용 프로토타입 [`v0.1.1`](https://github.com/Youngkwon-Lee/anti-turtle-meta-hud/releases/tag/v0.1.1)입니다. 측정 범위나 지원 장치를 확장하기 전에 [로드맵](docs/ROADMAP.md), [릴리스 체크리스트](docs/RELEASE_CHECKLIST.md), [오픈소스 검토](docs/OPEN_SOURCE_REVIEW.md), [Meta Ray-Ban Display 생태계 조사](docs/META_RAYBAN_OPEN_SOURCE_ECOSYSTEM.md)를 확인하세요.

## 팀 및 기여

초기 TOYTHON 안티터틀 해커톤 팀은 다음 네 명입니다.

- 구철회
- 박상준
- 홍주영
- 이영권 (`Youngkwon-Lee`)

현재 분리된 오픈소스 저장소는 `Youngkwon-Lee`가 유지관리하고 있습니다. 이 저장소의 Git 기록에는 해커톤 과정에서 이루어진 디자인, 하드웨어, 운영, 발표 등 코드 외 기여가 모두 나타나지 않을 수 있습니다.

## AI 활용 개발

코딩 에이전트가 저장소 전체에서 따라야 할 규칙은 [`AGENTS.md`](AGENTS.md)에 있습니다. Meta Display UI, IMU 보정, telemetry, macOS, 연구 범위 확장을 안전하게 구현하기 위한 재사용 가능한 Codex 스킬은 [`skills/anti-turtle-meta-hud/SKILL.md`](skills/anti-turtle-meta-hud/SKILL.md)에 포함되어 있습니다.

스킬을 로컬에 설치한 뒤 `$anti-turtle-meta-hud`로 호출하세요.

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R skills/anti-turtle-meta-hud "${CODEX_HOME:-$HOME/.codex}/skills/"
```

요청 예시:

```text
$anti-turtle-meta-hud를 사용해 신뢰도 기준이 있는 몸통 센서 어댑터를 추가하고,
HEAD/HYBRID 호환성을 유지하며, 테스트와 실제 장치 미검증 항목까지 보고해 주세요.
```

## 기여와 라이선스

기여는 [CONTRIBUTING.md](CONTRIBUTING.md)의 안내에 따라 환영합니다. 프로젝트는 [Apache License 2.0](LICENSE)으로 공개됩니다. 외부 라이브러리와 생성된 자산 관련 내용은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 정리되어 있습니다.

Meta, Meta AI, Ray-Ban, EssilorLuxottica는 각 소유자의 상표입니다. 이 프로젝트는 독립적인 커뮤니티 프로젝트이며 해당 회사의 공식 후원이나 보증을 받지 않았습니다.
