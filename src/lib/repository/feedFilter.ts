export const filterFeedItemsByTitle = <T extends { title: string }>(
  items: T[],
  titleFilterExpressions: string,
): T[] => {
  const expressions = titleFilterExpressions
    .split("\n")
    .filter((line) => line !== "");

  return items.filter((item) => {
    return !expressions.some((expression) => {
      let regex: RegExp;
      try {
        regex = new RegExp(expression);
      } catch {
        return false; // ignore invalid regex
      }
      return regex.test(item.title);
    });
  });
};
