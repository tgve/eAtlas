/**
 * eAtlas code
 *  
 * React component which takes a GeoJSON object. Loops through its
 * properties and show the list to start with. Each property 
 * can show all avialable values. Each value can be selected/deselected.
 *
 * Current code can deal with only one GeoJSON property's keys.
 * 
 * Next is handling multiple GeoJSON key value pairs.
 * Next will be replacing current "hard" code in the parent code,
 * so that all key values can be dynamically filtered.
 * 
 * This should be generalizeable to any GeoJSON file, or that is the
 * aim.
 */
import React, { Component } from 'react';

import './style.css';
import { humanize } from '../utils';
import { describeGeojson } from '../geojsonutils';
import { Button, SIZE, KIND } from 'baseui/button';

export default class Variables extends Component {
  constructor(props) {
    super(props);
    this.state = {
      list: null,
      showAll: false,
      selected: props.multiVarSelect || {}
    }
    this._generateList = this._generateList.bind(this);
    this._geoJSONPropsOrValues = this._geoJSONPropsOrValues.bind(this);
    this._processData = this._processData.bind(this);
    this._showSelectedVars = this._showSelectedVars.bind(this);
    this._showTopn = this._showTopn.bind(this);
    this._shorten = this._shorten.bind(this);
  }

  componentDidMount() {
    const { data } = this.props;
    if (!data || data.length === 0) return (null);
    this._processData(data);
  }

  componentDidUpdate(prevProps, prevState) {
    const { data } = this.props;
    if (!data || data.length === 0) return;
    
    if (data.length !== prevProps.data.length ||
      this.state.showAll !== prevState.showAll) {
      this._processData(data);
    }
  }

  /**
   * The main function in this clase.
   * 
   * Loops through properties of a GeoJSON object, 
   * generates both properties and their available values.
   * Uses Set to avaoid duplicates for each property values set.
   * 
   */
  _generateList() {
    const { data, onSelectCallback, style, subStyle,
      propertyValuesCallback } = this.props;
    const selected = this.state.selected;
    const description = describeGeojson(data[0]); // describe first feature
    const all = Object.keys(data[0].properties);
    const limit = this.state.showAll ? all.length : 10;
    // console.log(limit);

    const list = all.slice(0, limit)
      .map(key =>
        <span
          style={style}
          onClick={() => {
            if (key === "date") return;
            let sublist = [];
            data.forEach(feature =>
              Object.keys(feature.properties).forEach(property =>
                property === key && feature.properties[key] &&
                !sublist.includes(feature.properties[key]) &&
                sublist.push(
                  feature.properties[key]
                )
              )
            )
            // before turning them into spans
            typeof (propertyValuesCallback) === 'function' &&
              propertyValuesCallback({ key, sublist })

            sublist = sublist.map(each => each &&
              <span
                style={subStyle}
                onClick={() => {
                  //add each to the key
                  if (!selected.hasOwnProperty(key)) {
                    selected[key] = new Set()
                  }
                  selected[key].add(each + ""); // make sure it is string
                  typeof (onSelectCallback) === 'function' &&
                    onSelectCallback(selected)
                  this.setState({ selected })
                }}
                className="sub"
                key={each + ""}
              >
                {this._shorten(each, 20)}
              </span>
            )
            this.setState({
              sublist: sublist,
              key
            })
          }}
          key={key}>
          {this._shorten(key)}
          {' '}
          <i
            style={{ color: 'orange' }}
            className="data-type">
            [{description[key].name.substring(0, 3)}]
                </i>
        </span>
      )
    return (list)
  }

  _shorten(key, n = 10) {
    if (typeof (key) !== 'string') return key
    return key.length < n ? humanize(key) :
      humanize(key).substring(0, n) + "...";
  }

  /**
   * As state changes regenerate key/vlaues
   * @param {*} data 
   */
  _processData(data) {
    const list = this._generateList();
    this.setState({
      list,
      key: null,    // reset sublist
      sublist: null // reset sublist
    });
  }

  /**
   * 
   * @param {*} shownSublist 
   * @param {*} n 
   */
  _showTopn(shownSublist, n = 5) {
    if (shownSublist.length < n) n = shownSublist.length
    return <>
      {shownSublist.slice(0, n)}
      <p>Showing {n} out of {shownSublist.length}</p>
    </>;
  }

  /**
   * Word cloud of all values for a particular key.
   * 
   * @param {*} selected 
   * @param {*} key 
   */
  _showSelectedVars(selected, key) {
    const { onSelectCallback } = this.props;
    let ret = []
    selected && selected[key] && selected[key].size > 0 &&
      selected[key].forEach(each => {
        if (ret.length === 0) ret.push(<p key="chosen-label">
          <b>{` ${humanize(key)}'s `}</b> values</p>)
        //add remove
        ret.push(<i
          className="active-variable"
          style={this.props.subStyle}
          key={"remove-" + each} onClick={() => {
            selected[key].delete(each);
            if (selected[key].size === 0) delete selected[key]
            typeof (onSelectCallback) === 'function' &&
              onSelectCallback(selected)
            this.setState({ selected });
          }}>{`${each} `}<span
            style={{ borderRadius: '50%' }}
            className="unselect-variable">x</span></i>)
      });
    return (ret)
  }

  /**
   * Show:
   * 1. If filtered sublist has been populated and it is
   * above 5 (top 5)
   * 2. If all has been filtered then show nothing
   * 3. If 5 or less has been filtered show them
   * 4. Otherwise just show sublist UNfiltered (top 5)
   */
  _geoJSONPropsOrValues(shownSublist, selected, key, sublist, n = 5) {
    // console.log(selected);

    if (!sublist) return null
    if ((!shownSublist || shownSublist.length === 0) &&
      (!selected || !selected[key] || selected[key].size === 0)) {
      return this._showTopn(sublist)
    } else if (selected && selected[key] && selected[key].size ===
      sublist.length) {
      return null
    } else if (shownSublist.length > n) {
      return this._showTopn(shownSublist, n)
    }
    return shownSublist
  }

  render() {
    const { list, sublist, key, selected, showAll } = this.state;
    const { data } = this.props;
    const shownSublist = sublist && selected && key &&
      sublist.filter(each => {
        return selected[key] && each && !selected[key].has(each.key)
      })

    return (
      <div style={this.props.style}>
        Dataset:
                <div>
          <div className="tagcloud">
            {
              //show main GeoJSON key if there is one chosen
              key ?
                <>
                  <i>{`${humanize(key)}`}</i>
                  <span
                    onClick={() => this.setState({
                      sublist: null,
                      key: null
                    })}
                    style={{ borderRadius: '50%' }}
                    className="unselect-variable">x</span>
                </> :
                data && data.length > 1 &&
                  Object.keys(data[0].properties).length > 10 &&
                  !showAll ?
                  <>
                    First (10) of {
                      Object.keys(data[0].properties).length}:
                      {/* TODO: swap once theme is active */}
                    {this._button(showAll)}
                    {list}
                  </> :
                  <>
                    {
                      Object.keys(data[0].properties).length > 10 &&
                      this._button(showAll, "Less")
                    }
                    {list}
                  </>
            }
          </div>
          <div className="tagcloud">
            {
              this._geoJSONPropsOrValues(shownSublist, selected, key, sublist)
            }
          </div>
          <div className="tagcloud">
            {
              // simplest logic
              // if you click me, I will remove myself from the list
              this._showSelectedVars(selected, key)
            }
          </div>
        </div>
      </div>
    )
  }

  _button(showAll, title = "Show all") {
    return <Button size={SIZE.compact} kind={KIND.secondary}
      onClick={() => {
        this.setState({
          showAll: !showAll
        });
      }}>{title}</Button>;
  }
}
