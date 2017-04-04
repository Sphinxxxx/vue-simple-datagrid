//register the grid component
Vue.component('vdg-cell', {
    //template: '#cell-template',
    template:
		'<div>' +
		'    <template v-if="dataType === URL">' +
		'      <a :href="wrappedData[cellKey]" >{{ column.caption }}</a>' +
		'    </template>' +
		'    <template v-else-if="dataType === Boolean">' +
		'      <input v-model="wrappedData[cellKey]" v-on:change="changed(cellKey)" type="checkbox" v-bind:disabled="!isEditable" />' +
		'    </template>' +
		'    <template v-else-if="isEditable && dataType === Number">' +
		'      <input v-model="wrappedData[cellKey]" v-on:change="changed(cellKey)" type="number" />' +
		'    </template>' +
		'    <template v-else-if="isEditable">' +
		'      <input v-model="wrappedData[cellKey]" v-on:change="changed(cellKey)" />' +
		'    </template>' +
		'    <template v-else>' +
		'      <span>{{ wrappedData[cellKey] }}</span>' +
		'    </template>' +
		'</div>',

    props: {
        rowData: Object,
        column: Object
    },
    data: function() {
		//console.log('cell', this.rowData);
        return {
			//Must put this in the computed section, because .rowData will change after sorting the grid...
			//	wrappedData: this.rowData.wrapped,
            cellKey: this.column.key,
            dataType: this.column.type || String,
			isEditable: this.column.editable,
        }
    },
	computed: {
		wrappedData: function() {
			return this.rowData.wrapped;
		}
	},
    methods: {
        changed: function(key) {
            this.rowData.dirty = true;
			console.log('dirty', key, JSON.stringify(this.wrappedData));
        },
    }
});

Vue.component('vdg-grid', {
    //template: '#grid-template',
	template:
		'<div class="vue-datagrid">' +

		'  <div class="vdg-header">' +
		'    <div class="vdg-filter"><input v-model="filterKey"></div>' +
		'    <ul class="vdg-stats">' +
		'      <li class="vdg-selected">{{ actuallySelected.length }}</li>' +
		'      <li class="vdg-edited">{{ edited.length }}</li>' +
		'    </ul>' +
		'  </div>' +

		'  <table>' +
		'    <thead>' +
		'      <tr>' +

		'        <th>' +
		//https://vuejs.org/v2/guide/events.html#Method-Event-Handlers
		'          <input type="checkbox" @click="toggleSelectAll" />' +
		'        </th>' +

		'        <th v-for="col in columns"' +
		'          @click="sortBy(col.key)"' +
		'          :class="headerClasses(col.key)">' +
		'          {{ col.caption || col.key | capitalize }}' +
		'          <span class="arrow" :class="sortOrders[col.key] > 0 ? \'asc\' : \'dsc\'">' +
		'          </span>' +
		'        </th>' +

		'      </tr>' +
		'    </thead>' +
		'    <tbody>' +
		'      <tr v-for="row in filteredRows" :class="rowClasses(row)" >' +

		'        <td>' +
		'          <input type="checkbox" v-model="row.selected" />' +
		'        </td>' +

		'        <td v-for="col in columns" :class="col.key" >' +
		'          <vdg-cell :rowData="row"' +
		'          			 :column="col" >' +
		'          </vdg-cell>' +
		'        </td>' +

		'      </tr>' +
		'    </tbody>' +
		'  </table>' +
		'</div>',

    props: {
        data: Array,
        columns: Array,
        //filterKey: String
    },
    data: function() {
        var sortOrders = {};
        this.columns.forEach(function(col) {
            sortOrders[col.key] = -1;
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
		//	https://github.com/vuejs/vue/issues/4044
		//	https://github.com/vuejs/vue/issues/5186
		this.$emit('wrapped_rows', wrappedRows);
		
        return {
            filterKey: '',
            sortKey: '',
            sortOrders: sortOrders,
			wrappedRows: wrappedRows,
        };
    },
    computed: {
        filteredRows: function() {
            var sortKey = this.sortKey;
            var filterKey = this.filterKey && this.filterKey.toLowerCase();
            var order = this.sortOrders[sortKey] || 1;
            //console.log('filtering', this.filterKey);

            var cols = this.columns;
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
            //if (filterKey) {
                rows = rows.filter(function(row) {
                    row.filtered = (!filterKey) || rowOk(row, filterKey);
                    return row.filtered;
                });
            //}
            if (sortKey) {
				console.log('Sorting', rows.map(r => r.wrapped.medl_nr).join(','));
                rows = rows.slice();
				rows.sort(function(a, b) {
                    var aa = a.wrapped[sortKey],
						bb = b.wrapped[sortKey],
						sorted = (aa === bb ? 0 : aa > bb ? 1 : -1) * order;

					console.log('Comparing', aa, bb, sorted);
					return sorted;
                });
				console.log('Sorted ', rows.map(r => r.wrapped.medl_nr).join(','));
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
            return str.charAt(0).toUpperCase() + str.slice(1)
        }
    },
    methods: {
        sortBy: function(key) {
            this.sortKey = key
            this.sortOrders[key] = this.sortOrders[key] * -1
        },
		headerClasses: function(key) {
			var classes = key;
			if(this.sortKey === key) { classes += ' active'; }
			return classes;
		},
		rowClasses: function(row) {
			return row.dirty ? 'is-dirty' : '';
		},
		toggleSelectAll(e) {
			var check = e.currentTarget.checked;
			this.wrappedRows.forEach(function(row) {
				if(row.filtered) {
					row.selected = check;
				}
			});
		},
    }
});
