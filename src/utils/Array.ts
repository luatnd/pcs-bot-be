/* eslint-disable no-unused-vars */
type MapKey = string | number | symbol;

/**
 * Pick and return a random element from array a
 * @param a
 */
export function randomPick(a: any[]): any {
  return a[randInt(0, a.length - 1)];
}

/**
 * Convert array to dict
 *
 * @param {any[]} items Example: [{id: john}, {id: henry}]
 * @param {String} key
 * @returns {{}} Example: {john:{id: john}, henry: {id: henry}}
 */
export function toDict<T>(items: T[], key = 'id'): Record<any, T> {
  const itemsObj: Record<any, T> = {};
  for (let i = 0, c = items.length; i < c; i++) {
    const item = items[i];
    itemsObj[item[key]] = item;
  }

  return itemsObj;
}

/**
 * Convert array to dict with advance options
 *
 * @param items
 * @param getValue(element, index) transform each array elem into object elem
 * @param getKey(element) get dict key from element
 * @param filter(element, index) if filter was specified, only item that match the filter was return to result
 */
export function mapToDict<TIn, TOut>(
  items: TIn[],
  getValue: (item: TIn, idx?: number) => TOut,
  getKey: (item: TIn) => MapKey,
  filter?: (item: TIn, idx: number) => boolean,
): Record<MapKey, TOut> {
  const itemsObj = {} as Record<MapKey, TOut>;
  for (let i = 0, c = items.length; i < c; i++) {
    const item = items[i];
    const k = getKey(item);

    if (filter) {
      if (filter(item, i)) {
        itemsObj[k] = getValue(item, i);
      }
    } else {
      itemsObj[k] = getValue(item, i);
    }
  }

  return itemsObj;
}

/**
 * rand a int number in range [min..max]
 * @param min int
 * @param max int
 */
export function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max + 1));
}

// eslint-disable-next-line camelcase
// function test_randInt() {
//   const r = {};
//   let rnd;
//   for (let i = 0; i < 1e6; i++) {
//     if (!r[rnd]) r[rnd] = 0;
//     r[rnd] += 1;
//   }
// }
