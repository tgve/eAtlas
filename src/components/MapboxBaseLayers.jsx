import React from 'react';
import MultiSelect from './MultiSelect';

const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

export default class MapboxBaseLayers extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      bases: ['No map'].concat(MAPBOX_ACCESS_TOKEN ? [
        'dark',
        'basic',
        'streets',
        'bright',
        'light',
        'satellite',
      ] : ['OSM', 'OSMB', 'TONER', 'STADIA']),
      selected: props.dark ? "dark" : "streets"
    }
  }

  render() {
    const { selected, bases } = this.state;
    const { onSelectCallback, dark } = this.props;

    return (
      <MultiSelect
        title={selected === 'dark' ? "Default(dark)" :
          !dark ? "Default(streets)" : selected}
        single={true}
        values={
          bases.map(e => ({ id: e, value: e }))
        }
        value={selected && selected[0] && selected[0].value}
        onSelectCallback={(selected) => {
          console.log(selected)
          if (selected && selected.length) {
            this.setState({ selected: selected[0].value });
            typeof (onSelectCallback) === 'function' &&
              onSelectCallback(selected[0].value)
          }
        }}
      />
    )
  }
}
