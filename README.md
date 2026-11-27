# Cooking With SPAA v5.8α

## v5.8α アップデート概要

### 1. 機体3Dモデル（3パーツ分割GLB）システムの試験導入（Origin）
- **フォルダ構成の整理**:
  - 機体操作・読み込み・設定系統を `js/vehicles/` サブフォルダへ分離しました：
    - `js/vehicles/VehicleConfig.js`: 機体IDとフォルダ（`vehicle_01`〜`vehicle_08`）の対応・組み立てデフォルト座標管理
    - `js/vehicles/VehicleLoader.js`: `config.json` と `hull.glb` / `turret.glb` / `gun.glb` を読み込み、ダミーGLBまたは未配置時は同じ階層・寸法のプロシージャル3D戦車モデルへ自動フォールバック
    - `js/vehicles/VehicleController.js`: `OriginRoot -> HullRoot -> TurretPivot (0, 1.24, -0.15) -> GunPivot (0, 0.62, -0.62)` の親子階層を構築し、姿勢を制御
  - アセットは `assets/vehicles/vehicle_01/`（Origin用）〜 `vehicle_08/` を配置し、`vehicle_01`〜`vehicle_03` にダミーGLBと `config.json` を用意しています。

### 2. 車体・砲塔・砲の独立姿勢制御
- **車体（Hull）**: 移動スティックおよび移動キーを倒した方向へ滑らかに車体が向きます。
- **砲塔（Turret）**: 車体の子として配置され、プレイヤー視点操作の横軸（Yaw）のみに追従します。
- **砲（Gun）**: 砲塔の子として配置され、プレイヤー視点操作の縦軸（Pitch: 上下 `0`〜`90°`）のみに追従します。

### 3. 1人称視点 / 3人称視点 切り替えボタン追加
- 画面右上に `👁 3人称視点` / `👁 1人称視点` の切り替えボタンを追加しました（ホーム・格納庫・テストルーム・FallMissile・PlayWars で使用可能）。
- **3人称視点**: 自機3Dモデルを表示し、機体後方から見渡す追従カメラで操作します。
- **1人称視点**: 自機3Dモデルを非表示にし、従来の1人称視点カメラで操作します。

## 実GLBファイルの差し替え方法
お持ちの3分割GLBファイル（`Origin_hull.glb`、`Origin_turret.glb`、`Origin_gun.glb`）を以下のファイル名で上書き配置すると、自動で実モデルが表示されます：
- `assets/vehicles/vehicle_01/hull.glb`
- `assets/vehicles/vehicle_01/turret.glb`
- `assets/vehicles/vehicle_01/gun.glb`
