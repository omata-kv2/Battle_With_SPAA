# Cooking With SPAA v5.9β

## v5.9β アップデート内容

1. **Laser 3Dスキン追加 (`assets/vehicles/vehicle_05/`)**
   - `config.json` を追加し、`Laser_hull.glb` / `Laser_turret.glb` / `Laser_gun.glb`（ダミーGLB配置済み）の3パーツ構成に対応。
   - `js/vehicles/VehicleConfig.js` の `EXPERIMENTAL_3D_SKINS` に `'Laser'` を追加し、全8機体（`Origin`, `RapidFire`, `Explosion`, `Scatter`, `Laser`, `Automatic`, `Wirbelwind`, `Beast`）が3Dスキンに対応。
   - `js/vehicles/VehicleLoader.js` に Laser 用のフォールバック3Dモデルとオフセット・可動域デフォルトを追加。

2. **Explosion 3Dスキン刷新 (`assets/vehicles/vehicle_03/`)**
   - 従来の2パーツ構成から、他機体と同じ **3パーツ構成**（`Explosion_hull.glb` / `Explosion_turret.glb` / `Explosion_gun.glb`）へ更新。
   - `assets/vehicles/vehicle_03/config.json` を新仕様（PzH 2000 ベース）へ差し替え、旧ダミーファイル（`hull.glb` / `gun.glb`）を削除。
   - `js/vehicles/VehicleLoader.js` のフォールバック3Dモデルも3パーツ構成へ更新。

3. **格納庫 (`js/map-skin.js`) の大改修**
   - **マップ拡張**: 格納庫フロアを `84 × 46` に横幅拡張（床色 `0xb9b9bd` 維持、移動範囲・三人称視点の壁際クランプも拡張）。
   - **実寸1〜8号機展示**: 展示用の円柱台座を廃止し、各機体のテーマカラー枠内に装備時と同じ実寸の3D機体（1〜8号機）を展示。
   - **右→左の配置＆正面位置**: 奥の展示列に右から左へ `1 → 2 → 3 → ... → 8` の順で配置し、格納庫に入室した正面が **4号機（Scatter）と5号機（Laser）の間** を向くように調整。
   - **未解放機体の鎖牢屋エフェクト**: 未購入・未解放の機体枠には、枠の縁から機体より高い位置まで地面と垂直に伸びる鎖の牢屋（天井なし）と `🔒` マークを表示。
   - **パネル位置変更＆その場機体切替**: 機体選択・強化パネルを格納庫入口の右側に配置。パネルで機体を変更すると、ホームに戻らずその場で自機3Dモデルが切り替わります。
