export const getRandomColor = () => {
  const colorPalette = [
    "rgba(54, 162, 235, 0.5)", // 青系
    "rgba(255, 99, 132, 0.5)", // 赤系
    "rgba(75, 192, 192, 0.5)", // ターコイズ
    "rgba(153, 102, 255, 0.5)", // 紫系
    "rgba(255, 159, 64, 0.5)", // オレンジ系
  ];

  return colorPalette[Math.floor(Math.random() * colorPalette.length)];
};
