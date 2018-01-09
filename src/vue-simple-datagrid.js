Vue.component('vdg-cell', {
    //template: '#cell-template',
    template:
        '<div>' +
        '    <a v-if="!isEditable && dataType === URL"              :href="wrappedData[cellKey]" >{{ cellContent }}</a>' +
        //The <input>s need to bind to wrappedData[cellKey] (instead of cellContent),
        //or else the two-way binding won't change the data on user input.
        //We also add the .lazy modifier to our inputs, or else any active sorting 
        //rearranges the rows while the cursor stays in the same input (thus editing a different row):
        //https://vuejs.org/v2/guide/forms.html#Modifiers
        '    <input v-else-if="dataType === Boolean"                v-model="wrappedData[cellKey]"              v-on:change="changed(cellKey)"  type="checkbox" v-bind:disabled="!isEditable" />' +
        '    <input v-else-if="isEditable && dataType === Number"   v-model.lazy.number="wrappedData[cellKey]"  v-on:change="changed(cellKey)"  type="number" />' +
        '    <input v-else-if="isEditable"                          v-model.lazy="wrappedData[cellKey]"         v-on:change="changed(cellKey)" />' +
        '    <span v-else>{{ cellContent }}</span>' +
        '</div>',

    props: {
        rowData: Object,
        column: Object
    },
    data: function() {
        //console.log('cell', this.rowData);
        return {
            //Must put this in the computed section, because .rowData will change after sorting the grid...
            //  wrappedData: this.rowData.wrapped,
            cellKey: this.column.key,
            dataType: this.column.type || String,
            isEditable: this.column.editable,
        }
    },
    computed: {
        wrappedData: function() {
            return this.rowData.wrapped;
        },
        cellContent: function() {
            var data = this.wrappedData[this.cellKey];
            if(this.column.format) {
                try {
                    data = this.column.format(data);
                }
                catch (ex) {
                    console.warn('Format error (column ' +this.cellKey+ ', ' +typeof(data)+ ' ' +data+ '):', ex);
                }
            }
            return data;
        },
    },
    methods: {
        changed: function(key) {
            this.rowData.dirty = true;
            //console.log('dirty', key, JSON.stringify(this.wrappedData));
        },
    }
});

Vue.component('vdg-grid', {
    //template: '#grid-template',
    template:
        '<div class="vue-datagrid">' +

        '  <div class="vdg-header">' +
        '    <div class="vdg-filter"><input v-model="filter"></div>' +
        '    <ul class="vdg-stats">' +
        '      <li v-if="selectable" class="vdg-selected">{{ actuallySelected.length }}</li>' +
        '      <li v-if="columns || editable" class="vdg-edited">{{ edited.length }}</li>' +
        '    </ul>' +
        '  </div>' +

        '  <div class="vdg-table">' +
        '  <table>' +
        '    <thead>' +
        '      <tr>' +

        '        <th v-if="selectable">' +
        //https://vuejs.org/v2/guide/events.html#Method-Event-Handlers
        '          <input type="checkbox" @click="toggleSelectAll" />' +
        '        </th>' +

        '        <th v-for="col in actualCols"' +
        '          @click="setSort(col.key)"' +
        '          :class="headerClasses(col.key)">' +
        '          {{ colCaption(col) }}' +
        '          <span class="arrow" :class="sortOrders[col.key] > 0 ? \'asc\' : \'dsc\'">' +
        '          </span>' +
        '        </th>' +

        '      </tr>' +
        '    </thead>' +
        '    <tbody>' +
        '      <tr v-for="row in filteredRows" :class="rowClasses(row)" >' +

        '        <td v-if="selectable">' +
        '          <input type="checkbox" v-model="row.selected" />' +
        '        </td>' +

        '        <td v-for="col in actualCols" :class="col.key" >' +
        '          <vdg-cell :rowData="row"' +
        '                    :column="col" >' +
        '          </vdg-cell>' +
        '        </td>' +

        '      </tr>' +
        '    </tbody>' +
        '  </table>' +
        '  </div>' +

        '</div>',

    props: {
        data: Array,
        columns: Array,
        selectable: Boolean,
        editable: Boolean,
        search: String,
        sortBy: String,
    },
    data: function() {
        var cols = this.columns,
            canEdit = this.editable;
        if(!cols) {
            var sample = this.data[0];
            //Can't change .columns directly:
            //https://stackoverflow.com/questions/35548434/component-data-vs-its-props-in-vuejs
            //  this.columns = Object.keys(sample).map(function(k) {
            cols = Object.keys(sample).map(function(k) {
                var col = { key: k, type: String, editable: canEdit };
                try { col.type = sample[k].constructor } catch(ex) { }
                return col;
            });
        }
        if(canEdit) {
            cols.forEach(function(col) { col.editable = (col.editable !== false); });
        }

        var sortOrders = {},
            sortInitial = this.sortBy ? this.sortBy.match(/(\S+)/g) : [];
        cols.forEach(function(col) {
            var order = -1;
            if(sortInitial[0] === col.key) {
                //Default: Sort ascending if not told otherwise:
                order = (sortInitial[1] || '').toLowerCase() === 'desc'
                            ? -1
                            :  1;
            }
            sortOrders[col.key] = order;
        });

        var wrappedRows = this.data.map(function(d) {
            //console.log('Grid init, wrapping data..');
            return {
                wrapped: d,
                //We must define both .selected and .filtered here,
                //or else the computed property "actuallySelected" won't react to changes.
                filtered: true,
                selected: false,
                dirty: false,
            };
        });
        //Let our callee keep track of changes in the grid:
        //Event naming:
        //  https://github.com/vuejs/vue/issues/4044
        //  https://github.com/vuejs/vue/issues/5186
        this.$emit('wrapped_rows', wrappedRows);
        
        return {
            actualCols: cols,
            filter: this.search,
            sortKey: (sortInitial[0] || ''),
            sortOrders: sortOrders,
            wrappedRows: wrappedRows,
        };
    },
    computed: {
        filteredRows: function() {
            var sortKey = this.sortKey;
            var filterText = this.filter && this.filter.toLowerCase();
            var order = this.sortOrders[sortKey] || 1;
            //console.log('filtering', this.filter);

            var cols = this.actualCols;
            var rows = this.wrappedRows; //this.data;
            function rowOk(row, filter) {
                return /*Object.keys(row)*/cols.some(function(c) {
                    if(c.type === Boolean) { return false; }
                    var ok = String(row.wrapped[c.key]).toLowerCase().indexOf(filter) > -1;
                    //if(ok) { console.log('filtered', filter, row.wrapped[c.key]); }
                    return ok;
                });
            }
            //No if here - we also need to update the list when a filter is erased..
            //if (filterText) {
                rows = rows.filter(function(row) {
                    row.filtered = (!filterText) || rowOk(row, filterText);
                    return row.filtered;
                });
            //}
            if (sortKey) {
                rows = rows.slice();
                rows.sort(function(a, b) {
                    var aa = a.wrapped[sortKey] || '',
                        bb = b.wrapped[sortKey] || '',
                        sorted = (aa === bb ? 0 : aa > bb ? 1 : -1) * order;
                    return sorted;
                });
            }

            //console.log('filtered', (rows).map(JSON.stringify).join('\n'));
            return rows;
        },
        actuallySelected: function() {
            //console.log('actuallySelected...');
            return this.wrappedRows.filter(function(row) {
                return row.selected && row.filtered;
            });
        },
        edited: function() {
            //console.log('edited...');
            return this.wrappedRows.filter(function(row) {
                return row.dirty;
            });
        },
    },
    filters: {
        capitalize: function(str) {
            if(!str) return str;
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
    },
    methods: {
        setSort: function(key) {
            this.sortKey = key;
            this.sortOrders[key] = this.sortOrders[key] * -1;
        },
        headerClasses: function(key) {
            var classes = key;
            if(this.sortKey === key) { classes += ' active'; }
            return classes;
        },
        colCaption: function(col) {
            return (col.caption || (col.caption === ''))
                ? col.caption
                : this.$options.filters.capitalize(col.key);
        },
        rowClasses: function(row) {
            return row.dirty ? 'is-dirty' : '';
        },
        toggleSelectAll: function(e) {
            var check = e.currentTarget.checked;
            this.wrappedRows.forEach(function(row) {
                if(row.filtered) {
                    row.selected = check;
                }
            });
        },
    }
});
