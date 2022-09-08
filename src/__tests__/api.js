import { jsonFromKeySetObject, keySetObject } from '../utils/api';

test("keySetObject is valid", () => {
  expect(keySetObject("{not:['valid']}")).toBeNull()
  expect(keySetObject(null)).toBeNull()
  let str = `{"key1": ["val1"], "key2": ["val2"]}`
  const set1 = keySetObject(str)
  str = `key1:val1:key2:val2`
  const set2 = keySetObject(str)
  expect(Object.keys(set1)).toEqual(Object.keys(set2))
  expect(Object.values(set1)).toEqual(Object.values(set2))

})

test("jsonFromKeySetObject is valid", () => {
  const m = {a: new Set([1,2]), b: new Set([3,4])}
  const r = jsonFromKeySetObject(m)
  console.log(r);
  expect(JSON.stringify(r)).toEqual('{\"a\":[1,2],\"b\":[3,4]}')
  expect(jsonFromKeySetObject()).toEqual({})
})
