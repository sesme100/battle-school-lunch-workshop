# Azure에 앱 배포하기

지금까지 구현한 앱은 로컬에서 잘 동작하는 것을 확인했습니다. 그렇다면, 이 앱을 클라우드로 배포할 순서입니다. 이 세션에서는 `azd` 명령어를 사용해서 로컬에서 Azure 클라우드로 배포하는 작업을 합니다.

> [!NOTE]
> 현재 보이는 스크린샷은 시간이 지나면서 UI 업데이트로 인해 현재 시점과 다를 수 있습니다.

## 직접 프롬프트 입력하기

1. Copilot app의 "Home" 탭에서 아래와 같이 직접 프롬프트를 입력합니다. 이 때 [Azure Skills](https://github.com/microsoft/azure-skills)를 사용하면 더욱 편리합니다. Azure Skills는 Copilot 앱에 기본 설치되어 있습니다. 일반적으로는 `/azure-prepare` 스킬을 사용하지 않아도 프롬프트의 맥락을 이해하고 자동으로 스킬을 호출하지만, 명시적으로 `/azure-prepare` 스킬을 호출해서 프롬프트를 작성해도 괜찮습니다.

    ```text
    현재 구현된 앱을 Azure 클라우드로 배포할 거야. `azd` CLI를 사용해서 배포할 계획이니 초기화 명령어를 통해 관련한 bicep 파일을 만들고 `azd` 명령어로 배포할 수 있도록 준비해 줘.
    ```

   또는 아래와 같이 `/azure-prepare` 스킬을 명시적으로 호출해 보세요.

    ```text
    /azure-prepare 현재 구현된 앱을 Azure 클라우드로 배포할 거야. `azd` CLI를 사용해서 배포할 계획이니 초기화 명령어를 통해 관련한 bicep 파일을 만들고 `azd` 명령어로 배포할 수 있도록 준비해 줘.
    ```

1. 생성된 `.azure/deployment-plan.md`, `azure.yaml`과 `infra/`를 검토합니다. 이
   워크숍에서는 이후 단계의 MCP 서버와 멀티에이전트 앱을 같은 컨테이너
   환경에 추가할 수 있도록 다음 Azure 리소스를 사용합니다.

   - 프론트엔드와 백엔드용 Azure Container Apps
   - Azure Container Registry Basic
   - Container Apps Environment
   - Log Analytics와 Application Insights
   - Key Vault와 관리 ID

   두 Container App은 유휴 시 scale-to-zero합니다. Korea Central의 공개
   소매가와 워크숍 수준 사용량을 기준으로 월 예상 비용은
   **USD 5.2-6.5**이며, ACR Basic이 대부분을 차지합니다. 실제 사용량에
   따라 이 예상보다 비용이 늘어날 수 있고, 10단계의 데이터베이스 비용은
   포함하지 않습니다.

1. 실제 리소스를 만들기 전에 로컬 구성과 애플리케이션을 검증합니다.

    ```bash
    azd show
    az bicep build --file infra/main.bicep
    docker compose config
    ```

   프론트엔드와 백엔드의 테스트, 린트와 빌드도
   [README](../README.md)의 명령으로 실행합니다.

1. azd 환경에 대상 구독과 리전을 설정하고, 실제 `NEIS_API_KEY`는 셸의
   비공개 입력 기능을 사용해 로컬 azd 환경에만 저장합니다. 키를 소스,
   프롬프트, 명령 예시 또는 로그에 기록하지 마세요.

1. 계획의 대상 구독, 리전, 생성 리소스와 예상 비용을 사용자에게 보여 주고
   명시적인 배포 승인을 받습니다.

   > [!WARNING]
   > 다음 `azd up` 명령은 Azure 리소스를 만들고 비용을 발생시킬 수
   > 있습니다. 준비나 검증 승인을 실제 배포 승인으로 간주하지 마세요.

1. 승인을 받은 뒤 아래 명령어를 이용해서 앱을 배포합니다.

    ```bash
    azd up
    ```

   ![`azd up` 명령어로 앱 배포하기](./images/06-deplopy-to-azure-01.jpg)

   또는 Azure Skills를 이용해서 프롬프트로 배포해도 됩니다. `/azure-deploy` 스킬을 사용합니다.

    ```text
    /azure-deploy
    ```

   ![`/azure-deploy` 스킬로 앱 배포하기](./images/06-deplopy-to-azure-02.jpg)

1. 앱 배포가 잘 된 것을 확인합니다. 만약 배포중 에러가 발생한다면 추가 프롬프트를 이용해서 배포 에러를 수정합니다.
1. "Create PR" 버튼을 클릭하여 변경 사항을 PR로 생성한 후 머지합니다.
1. 머지가 완료된 것을 확인합니다.

---

Azure 클라우드에 앱을 잘 배포했습니다. [GitHub Actions로 앱 테스트 및 배포 자동화하기](./07-generate-github-actions.md)로 넘어가세요.
