/**
 * Created by Carolina Nobre on 01.22.2017
 */
/**
 * Data structure for the genealogy graph.
 */
import {
  max,
  min,
  mean
} from 'd3-array';

class graphData {

  public nodes;
  private uniqueID;

  //Array of Parent Child Edges
  public parentChildEdges = [];

  //Array of Parent Parent Edges
  public parentParentEdges = [];

  //Used to count nuclear families in a tree
  private nuclearFamilyCounter = 1;


  constructor(data) {
    this.nodes = data;
    // this.uniqueID = [];

    //Sort nodes by y value, always starting at the founder (largest y) ;
    this.nodes.sort(function (a, b) {
      return b['y'] - a['y']
    });

    //Initially set all nodes to visible (i.e, not hidden)  and of type 'single' (vs aggregate)
    this.nodes.forEach(d => {
      // d['index'] = d.id;
      d['type'] = 'single';
      d['hidden'] = false;
      d['aggregated'] = false;
      d['bdate'] = +d['bdate'];
      d['deceased'] = d['deceased'] == 'Y'; //transform to boolean values
      // d['color'] = +d['affection'] == 1 ? 'black' : 'white'; //Set color in view, not here.
      d['generation'] = -1; //indicator that generation has not been set
      d['descendant'] = false; //flag for blood descendants of founders - not in use yet (2/23/17)
      d['x'] = +d['bdate'] //set year as x attribute
      d['Y'] = +d['y']; //keeps track of nodes original y position
      d['X'] = +d['x']; //keeps track of nodes original x position - can change for kid grids on hide.
      d['family_ids'] = []; //keeps track of nuclear families a given node belongs to.
      d['clicked'] = false; //used to keep track of clicked nodes even when they are removed from the visible area. May not need if nodes are not removed and simply scroll out of view.

      //For Tree structure
      d['hasChildren'] = false;
      d['children'] = [] //Array of children
      d['spouse'] = []; //Array of spouses (some have more than one)

      //Define 'affected' state. Can be modified by the user with definePrimary();
//       d['affected'] = +d["affection"] == 100;
      d['affected'] = Math.random() > 0.95

      // this.uniqueID.push(+d['id']);
    });

    // this.definePrimary('suicide', 'Y', undefined);
    this.buildTree();
    // this.computeGenerations();
  }


  /**
   *
   * This function defined the 'affected' state based on a user defined attribute.
   * 1) between parents and their children -> parent child edges.
   * 2) between couples -> parent parent edges
   *
   * @param attribute attribute to be used to define 'affected' state of nodes.
   * @param threshold threshold to apply to attribute when defining 'affected'. Array of 1 or two values.
   * @param compareOperator can be >,<,=, or 'range' to apply to attribute when defining 'affected'
   */
  private definePrimary(attribute, threshold, compareOperator) {
    this.nodes.forEach((node) => {
      node['affected'] = node[attribute] == threshold;
    })

  }

  /**
   *
   * This function creates edges objects and adds the references between parents and children to create a tree.
   * It creates two types of edges:
   * 1) between parents and their children -> parent child edges.
   * 2) between couples -> parent parent edges
   *
   * It populates the class attributes parentParentEdges and parentChildEdges.
   */

  private buildTree() {

    this.nodes
      .forEach(node => {
        //Check if there are mother and father nodes in this family (founder won't have them for example)
        let maNode = this.nodes.filter((d) => {
          return d['id'] == node['ma']
        });
        let paNode = this.nodes.filter((d) => {
          return d['id'] == node['pa']
        });

        //No parents found
        if (maNode.length == 0 || paNode.length == 0) {
          node['ma'] = undefined;
          node['pa'] = undefined;
        }

        // If found parents, create edges between parent and children, spouses, and add references to build tree
        else {
          maNode = maNode[0];
          paNode = paNode[0];

          //Replace ma and pa fields with reference to actual ma/pa nodes
          node['ma'] = maNode;
          node['pa'] = paNode;

          //relationship node. Used to build parent child edges
          let rnode = {
            'ma': maNode,
            'pa': paNode,
            'type': 'parent',
            'id': Math.random() //Create random id or each parentParent Edge.
          };

          //Only add parent parent Edge if it's not already there;
          if (!this.parentParentEdges.some((d) => {
              return d['ma'] == rnode['ma'] && d['pa'] == rnode['pa'];
            })) {
            this.parentParentEdges.push(rnode);

            //Set spouse fields
            maNode['spouse'].push(paNode);
            paNode['spouse'].push(maNode);
          }

          //Set flag for people with children so they are not placed in the kidGrid
          maNode.hasChildren = true;
          paNode.hasChildren = true;

          //Add child to array of children of each parent
          maNode.children.push(node);
          paNode.children.push(node);


          this.parentChildEdges.push({
            ma: maNode,
            pa: paNode,
            target: node,
            'id': node.id //id of parentChild Edge is the id of the child.
          });
        }
      });
  };

  /**
   *
   * This function traverses down the tree to find the index of the last (upwards) leaf node in a given branch
   *
   * @param node - starting node.
   */
  public findLastLeaf(node) {

    console.log('find last leaf ', node)
    //Base case -> leaf node w/ no spouse
    if (node['spouse'].length == 0 && !node['hasChildren']) {
      return node['y'];
    }

    //Base case -> leaf node w/ spouse
    else if (node['spouse'].length > 0 && !node['hasChildren']) {
      let levels = [node['y']];
      node['spouse'].forEach((s) => {
        levels.push(s['y'])
      });
      return max(levels);
    }

    //Has only one spouse -> call find lastLeaf on each of their children.
    else if (node['spouse'].length == 1) {
      return min(node['children'].map((child) => {
        return this.findLastLeaf(child);
      }));
    }

    //Has more than one spouse, find last Leaf of all children in these relationships
    else if (node['spouse'].length > 1) {
      return min(node['spouse'].map((spouse) => {
        return min(spouse['children'].map((child) => {
          return this.findLastLeaf(child)
        }));
      }));
    }
  };

  /**
   *
   * This function hides all the nodes that descend from a given starting point. to the end of that branch.
   *
   * @param startIndex - y value (row number) for the starting point.
   */
  public hideNodes(startIndex) {

    let Y = startIndex;

    //Find the non hidden node in that row
    let startNode = this.nodes.filter((node) => {
      return (node['y'] == startIndex && !node['hidden']);
    })

    //Iterate down that branch to find the last index of this family.
    let endIndex = this.findLastLeaf(startNode[0]);

    this.nodes.sort((a, b) => {
      return b['Y'] - a['Y']
    });

    //Assign a row for each affected case within the range to be collapsed;
    this.nodes.filter((node) => {
      return node['y'] <= startIndex && node['y'] >= endIndex
    }).forEach((node) => {

      //non affected leaf nodes
      if (!node['hasChildren'] && !node['affected']) {

        let ma = node['ma'];
        let pa = node['pa'];

        //If both parents are affected
        if (ma['affected'] && pa['affected']) {
          //place kid grid in the middle
          node['y'] = (ma['y'] + pa['y']) / 2
        }
        //Only mother is affected,
        else if (ma['affected']) {
          if (node['sex'] == 'M')
            node['y'] = ma['y'] - 0.2;
          else
            node['y'] = ma['y'] + .2
        }
        //Only father is affected
        else if (pa['affected']) {
          if (node['sex'] == 'M')
            node['y'] = pa['y'] - 0.2;
          else
            node['y'] = pa['y'] + 0.2
        }
        //Neither parent is affected
        else {
          if (node['sex'] == 'M')
            node['y'] = pa['y'];
          else
            node['y'] = ma['y'];
        }

        //Starting point for the kid grid
        node['x'] = ma['x'] + 6;
      } //end leaf nodes

      //Affected nodes and non-leaf nodes
      else {
        //Non-leaf and non-affected nodes
        if (!node['affected']) {

          let spouse = node['spouse'];

          if (spouse.length > 0) { //they had at least one partner
            spouse = spouse[0];

            //Affected Spouse
            if (spouse['affected']) {
              if (node['sex'] == 'M')
                node['y'] = spouse['y'] - 0.2;
              else
                node['y'] = spouse['y'] + 0.2;
            }
            //Non affected Spouse
            else {
              if (node['sex'] == 'M')
                node['y'] = Y - 0.2;
              else
                node['y'] = Y + 0.2;
            }

          }

        }

        //Affected Nodes
        else {
          node['y'] = Y;
//             //Search for spouse and place in the right location (if not affected)
//             let edge = this.parentParentEdges.filter((d) => {
//               return node['sex'] == 'M' ? d['pa'] == node : d['ma'] == node
//             });
//
//             if (edge.length > 0) {
//               let spouse;
//               if (node['sex'] == 'M')
//                 spouse = edge[0]['ma'];
//               else
//                 spouse = edge[0]['pa'];
//
//               if (!spouse['affected']) {
//                 if (node['sex'] == 'M')
//                   spouse['y'] = Y //-0.2;
//                 else
//                   spouse['y'] = Y //+0.2;
//               }
// // 		          	spouse['y']= Y //-1 +0.4;
//
//             }
        }

        //Place Mom and Dad Nodes on top of Each other (at the dad's x location)
        if (node['sex'] == 'F' && node['spouse'].length > 0) {
          node['x'] = node['spouse'][0]['x']; //need to figure out how to handle multi spouse situations 2/23/2017
        }

      }

      if (node['affected'])
        Y = Y - 1;
      else {

        //Check if you are at the end of a branch w/ only unaffected leaf children.

        let unaffectedLeafChildren = !this.hasAffectedChildren(node);

        //If current node has only unaffected leaf children and does not have any affected spouses and is not a leaf
        let newBranch = unaffectedLeafChildren && node['hasChildren'] &&
          node['spouse'].reduce((acc, spouse) => {return acc && !spouse['affected']}, true)
          && node['Y'] < max(node['spouse'].map((s) => {return s['Y']}));


        if (newBranch) {
          Y = Y - 1;
          console.log('new Branch for node , ',  node['y'] )
        }

        node['hidden'] = true;
      }
    });


    //Get rid of blank rows;
    this.nodes.filter((d) => {
      return d.y >= endIndex
    }).forEach((node) => {
      node['y'] = node['y'] - (Y - endIndex + 1);
    })
  }


  /**
   *
   * This function returns true if this node has any affected leaf children.
   *
   * @param node to query
   * @return true/false indicating whether this node has any affected leaf children
   */
  private hasAffectedChildren(node){
    let value = node['children'].reduce((acc, child) => {
      return acc && !child['affected'] && !child['hasChildren']
    }, true)

    return !value;

  }

}


/**
 * Method to create a new graphData instance
 * @param data
 * @returns {graphData}
 */
export function create(data) {
  return new graphData(data);
}
