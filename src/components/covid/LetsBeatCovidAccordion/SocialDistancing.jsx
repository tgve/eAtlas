import React, { useState } from "react";
import { RadioGroup, Radio } from "baseui/radio";


export default (props) => {
  const [value, setValue] = useState("symptoms");
  return (
    <RadioGroup
      value={value}
      onChange={e => { setValue(e.target.value); typeof props.onSelectCallback === "function" && props.onSelectCallback("amount_of_contact", e.target.value) }}
      name="number"
    // align={ALIGN.vertical}
    >
      <Radio value="no_large_groups">Avoiding large groups of people</Radio>
      <Radio value="reduced_contact">Reducing contact with other people</Radio>
      <Radio value="minimal_contact">Zero or minimal contact with other people</Radio>
      <Radio value="none">No changes to contact</Radio>
    </RadioGroup>
  );
}