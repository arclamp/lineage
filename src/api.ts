import { json } from 'd3-request';

function promisifyGet (url ) {
    return new Promise((resolve, reject) => {
        json(url, (error, data) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(data);
        });
    });
}

function promisifyPost (url, postContent) {
    return new Promise((resolve, reject) => {
        json(url)
            .header('Content-Type', 'application/json')
            .post(JSON.stringify(postContent), (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(data);
            });

    });
}

export async function getNode (nodeId) {
    const query = JSON.stringify({
        query: `query {
            nodes (workspace: "dblp", graph: "coauth", nodeType: "author", key: "author/${nodeId}") {
                total
                nodes {
                    key
                    type
                    incoming {
                        total
                        edges (limit: 20) {
                            source {
                                outgoing {
                                  total
                                }
                                properties (keys: ["type", "title", "_key"]) {
                                    key
                                    value
                                }
                            }
                        }
                    }
                    properties (keys: ["type", "name"]) {
                        key
                        value
                    }
                }
            }
        }`
    });

    const graph = await new Promise((resolve, reject) => {
        json('/multinet/graphql')
            .post(query, (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            });
    });

    console.log('graph', graph);

    const author = graph.data.nodes.nodes[0];

    const props = (() => {
        let p = {};
        author.properties.forEach(prop => {
            p[prop.key] = prop.value
        });
        return p;
    })();

    const authorData = {
        graphDegree: author.incoming.total,
        label: 'Author',
        title: props.name,
        uuid: author.key.split('/')[1]
    };

    const makeLink = (link) => {
        const props = (() => {
            let p = {};
            link.source.properties.forEach(prop => {
                p[prop.key] = prop.value;
            });
            return p;
        })();

        return {
            source: authorData,
            target: {
                graphDegree: link.source.outgoing.total,
                label: 'Article',
                title: props.title,
                uuid: props._key
            }
        };
    };

    const links = author.incoming.edges.map(makeLink);
    const targetNodes = links.map(l => l.target);

    return {
        nodes: [authorData],
        links,
        root: [author.key.split('/')[1]],
        targetNodes
    };
}

export function getNodeTree(graph, db, root, includeRoot) {
    let url = `api/data_api/graph/${db}`;
    if (root) {
        url += `/${encodeURIComponent(root)}/${includeRoot.toString()}`;
    }

    return promisifyPost(url, {
        treeNodes: graph ? graph.nodes.map((n) => n.uuid) : ['']
    });
}

export function getNodes(selectedDB, graph, info) {
    console.log('getNodes()');

    return promisifyPost(`api/data_api/getNodes/${selectedDB}`, {
        rootNode: '',
        rootNodes: info.children.map((n) => n.uuid),
        treeNodes: graph.nodes.map((n) => n.uuid)
    });
}

export function getProperty(db, name, graph) {
    console.log('getProperty()');

    return promisifyPost(`api/data_api/property/${db}/${name}`, {
        treeNodes: graph ? graph.nodes.map((n) => { return n.uuid; }) : ['']
    });
}

export function getProperties(db) {
    console.log('getProperties()');

    return promisifyGet(`api/data_api/properties/${db}`);
}

export function getLabels(db) {
    console.log('getLabels()');

    return promisifyGet(`api/data_api/labels/${db}`);
}

export function getEdges(db, uuid, nodes) {
    console.log('getEdges()');

    return promisifyPost(`api/data_api/edges/${db}/${encodeURIComponent(uuid)}`, {
        treeNodes: nodes
    });
}

export function filter(db, search) {
    console.log('filter()');

    return promisifyPost(`api/data_api/filter/${db}`, {
        searchString: search
    });
}

export function query(db, search) {
    console.log('query()');

    return promisifyPost(`api/data_api/query/${db}`, {
        searchString: search
    });
}
