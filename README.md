# Cooking With SPAA v5.8β

## v5.8β アップデート概要

### 1. Wirbelwind 3Dスキン（3パーツ分割GLB）追加
- `EXPERIMENTAL_3D_SKINS` に **`Wirbelwind`** を追加し、Origin と同様に3パーツ分割GLBによる3D機体表示・姿勢制御に対応しました。
- **参照アセットパス（自動探索）**:
  - `assets/vehicles/vehicles_07/` または `assets/vehicles/vehicle_07/` 内の `hull.glb` / `turret.glb` / `gun.glb`（および `Wirbelwind_hull.glb` 等、`assets/models/Wirbelwind/` 配下も探索）
  - 組み立て座標は `config.json`（`turretPivot: [0, 1.24, -0.15]`, `gunPivot: [0, 0.62, -0.62]`, 仰角 `0〜90°`）に準拠しています。
- **ダミーフォールバック対応**:
  - 実GLBファイルが未配置・ダミーの場合は、金色メタリック＋赤ライン＋4連装20mm対空砲の簡易3Dモデルが自動表示されます。

### 2. 車体・砲塔・砲の姿勢制御（Origin / Wirbelwind共通）
- **車体（Hull）**: 移動スティック・移動キーを倒した方向へ滑らかに向きます。
- **砲塔（Turret）**: 車体の子として、プレイヤー視点操作の横軸（Yaw）のみに追従します。
- **砲（Gun）**: 砲塔の子として、プレイヤー視点操作の縦軸（Pitch: 上下のみ）に追従します。
