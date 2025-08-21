export const createDateArrayPerMonth = (monthLists: string[]) => {
  return monthLists.sort().map((date) => {
    const [__, month, day] = date.split("-");
    return `${month}/${day}`;
  });
};

export const createDateObjectPerMonthWithInitialCounts = () => {
  const today = new Date();
  const oneMonthAgo = new Date(today.setMonth(today.getMonth() - 1));
  oneMonthAgo.setDate(oneMonthAgo.getDate() + 1);
  const initialCounts: { [key: string]: number } = {};

  for (
    let d = new Date(oneMonthAgo);
    d <= new Date();
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().split("T")[0];
    initialCounts[dateStr] = 0;
  }
  return initialCounts;
};
