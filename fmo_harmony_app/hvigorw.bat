@echo off
rem
rem Copyright (c) 2024 Huawei Device Co., Ltd.
rem Licensed under the Apache License, Version 2.0 (the "License");
rem you may not use this file except in compliance with the License.
rem You may obtain a copy of the License at
rem
rem     http://www.apache.org/licenses/LICENSE-2.0
rem
rem Unless required by applicable law or agreed to in writing, software
rem distributed under the License is distributed on an "AS IS" BASIS,
rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
rem See the License for the specific language governing permissions and
rem limitations under the License.
rem

setlocal

set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.\
set HVIGOR_HOME=%DIRNAME%.hvigor
set HVIGOR_JAR=%HVIGOR_HOME%\hvigor.jar

if not exist "%HVIGOR_JAR%" (
    echo Hvigor environment not initialized. Please run hvigor init first.
    exit /b 1
)

java -jar "%HVIGOR_JAR%" %*

endlocal