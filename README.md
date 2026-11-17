# Cooking With SPAA v2.4

## GitHub Pagesへの反映
**ZIPに含まれる7ファイルだけ差し替えてください。** ZIP内の `Cooking_With_SPAA_v21/` の中身をリポジトリ直下へ配置します。リポジトリ全体の削除・置き換えは不要です。

**既存の `js/libs/` と `assets/` は置き換えず、そのまま残してください。** このZIPにはどちらのフォルダも含めていません。

## 必要な既存ファイル
- `js/libs/three.module.js`（Three.js r160）
- `js/libs/examples/jsm/loaders/GLTFLoader.js`（Three.js r160）
- `js/libs/examples/jsm/utils/BufferGeometryUtils.js`（既に配置済みならそのままでOK）
- `assets/Kh-35.glb`
- `assets/SU-27.glb`

`index.html` に import map を追加し、GLTFLoader内の `three` の読み込み先をローカルの `three.module.js` に対応させています。GLTFLoaderの相対参照が成立するよう、指定されたフォルダ階層を維持してください。

## v2.4変更点
- `GLTFLoader.js` を使って `assets/Kh-35.glb` と `assets/SU-27.glb` を読み込むよう変更
- GLBの読み込みに失敗した場合は、従来の簡易3Dモデルで代替してゲームを続行
- 読み込んだモデルの大きさをゲーム内サイズに合わせて自動調整
- 残りターゲット数の表示を戦闘機分も含めて正しく計算
- v2.3のウェーブ数、速度倍率、アナログスティック、視点操作、タッチ対策を維持

## 操作
- PC：WASD / 矢印キー移動、マウス視点、Space発射
- タッチ：左下スティック移動、画面右側ドラッグで視点、PULSE発射

## 注意
このZIPは `js/libs/` と `assets/` を含みません。GitHub側に既にあるファイルを保持してください。
